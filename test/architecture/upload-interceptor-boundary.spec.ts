import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import ts from 'typescript';

type Source = {
  readonly path: string;
  readonly content: string;
};

const srcRoot = join(__dirname, '..', '..', 'src');
const uploadOptionsPath = join(
  srcRoot,
  'integrations/media/api/upload-options.ts',
);
const optionArgumentIndex = new Map([
  ['FileInterceptor', 1],
  ['FileFieldsInterceptor', 1],
  ['FilesInterceptor', 2],
]);
const uploadLimitProperties = new Set(['fileSize', 'files', 'maxCount']);

function readSources(directory = srcRoot): Source[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return readSources(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    return [
      {
        path: relative(srcRoot, absolutePath).split(sep).join('/'),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

function propertyName(node: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return undefined;
}

function hasFileSizeLimit(options: ts.ObjectLiteralExpression): boolean {
  const limits = options.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === 'limits' &&
      ts.isObjectLiteralExpression(property.initializer),
  );
  if (
    limits === undefined ||
    !ts.isObjectLiteralExpression(limits.initializer)
  ) {
    return false;
  }

  return limits.initializer.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === 'fileSize',
  );
}

function safeOptionFactories(): Set<string> {
  const content = readFileSync(uploadOptionsPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    uploadOptionsPath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const factories = new Set<string>();

  sourceFile.forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || node.name === undefined) return;
    let safe = false;
    const visit = (child: ts.Node): void => {
      if (
        ts.isReturnStatement(child) &&
        child.expression !== undefined &&
        ts.isObjectLiteralExpression(child.expression) &&
        hasFileSizeLimit(child.expression)
      ) {
        safe = true;
      }
      ts.forEachChild(child, visit);
    };
    if (node.body !== undefined) visit(node.body);
    if (safe) factories.add(node.name.text);
  });

  return factories;
}

function namedImports(
  sourceFile: ts.SourceFile,
  moduleName: string,
): Map<string, string> {
  const imports = new Map<string, string>();

  sourceFile.forEachChild((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      node.moduleSpecifier.text !== moduleName ||
      node.importClause?.namedBindings === undefined ||
      !ts.isNamedImports(node.importClause.namedBindings)
    ) {
      return;
    }
    for (const element of node.importClause.namedBindings.elements) {
      imports.set(
        element.name.text,
        element.propertyName?.text ?? element.name.text,
      );
    }
  });

  return imports;
}

function uploadInterceptorViolations(source: Source): string[] {
  const sourceFile = ts.createSourceFile(
    source.path,
    source.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const interceptorImports = namedImports(
    sourceFile,
    '@nestjs/platform-express',
  );
  const optionFactoryImports = namedImports(
    sourceFile,
    'src/integrations/media/api/upload-options',
  );
  const safeFactories = safeOptionFactories();
  const violations: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const importedName = interceptorImports.get(node.expression.text);
      const optionsIndex =
        importedName === undefined
          ? undefined
          : optionArgumentIndex.get(importedName);

      if (optionsIndex !== undefined) {
        const options = node.arguments[optionsIndex];
        const usesSafeInlineOptions =
          options !== undefined &&
          ts.isObjectLiteralExpression(options) &&
          hasFileSizeLimit(options);
        const importedFactory =
          options !== undefined &&
          ts.isCallExpression(options) &&
          ts.isIdentifier(options.expression)
            ? optionFactoryImports.get(options.expression.text)
            : undefined;
        const usesSafeFactory =
          importedFactory !== undefined && safeFactories.has(importedFactory);

        if (!usesSafeInlineOptions && !usesSafeFactory) {
          const line =
            sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push(
            `${source.path}:${line} ${importedName} requires options with limits.fileSize`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return violations;
}

function containsNumericLiteral(node: ts.Node): boolean {
  if (ts.isNumericLiteral(node)) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (containsNumericLiteral(child)) found = true;
  });
  return found;
}

function numericUploadLimitViolations(source: Source): string[] {
  if (source.path === 'integrations/media/api/upload-limits.ts') return [];

  const sourceFile = ts.createSourceFile(
    source.path,
    source.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      uploadLimitProperties.has(propertyName(node.name) ?? '') &&
      containsNumericLiteral(node.initializer)
    ) {
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      violations.push(
        `${source.path}:${line} ${propertyName(
          node.name,
        )} must use upload-limits.ts`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return violations;
}

describe('Upload interceptor architecture boundary', () => {
  it('requires finite file-size options on every upload interceptor', () => {
    const violations = readSources().flatMap(uploadInterceptorViolations);

    expect(violations).toEqual([]);
  });

  it('detects missing and empty options for every supported interceptor', () => {
    const violations = uploadInterceptorViolations({
      path: 'unsafe-upload.controller.ts',
      content: `
        import {
          FileInterceptor,
          FileFieldsInterceptor,
          FilesInterceptor,
        } from '@nestjs/platform-express';

        FileInterceptor('file');
        FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]);
        FilesInterceptor('files', 2);
        FileInterceptor('file', {});
      `,
    });

    expect(violations).toHaveLength(4);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('FileInterceptor requires options'),
        expect.stringContaining('FileFieldsInterceptor requires options'),
        expect.stringContaining('FilesInterceptor requires options'),
      ]),
    );
  });

  it('keeps upload limit number literals in upload-limits.ts', () => {
    const violations = readSources().flatMap(numericUploadLimitViolations);

    expect(violations).toEqual([]);
  });

  it('detects inline file-size, file-count, and field-count literals', () => {
    const violations = numericUploadLimitViolations({
      path: 'unsafe-upload.controller.ts',
      content: `
        const options = { limits: { fileSize: 10 * 1024, files: 2 } };
        const fields = [{ name: 'image', maxCount: 3 }];
      `,
    });

    expect(violations).toEqual([
      expect.stringContaining('fileSize must use upload-limits.ts'),
      expect.stringContaining('files must use upload-limits.ts'),
      expect.stringContaining('maxCount must use upload-limits.ts'),
    ]);
  });
});
