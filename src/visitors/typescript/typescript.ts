import { CustomImportConfig } from '../../config';
import {
  findDuplicateIdentifier,
  normalizeDuplicateProperties,
  normalizeUrl,
} from '../common';
import {
  NodeConstraintMembers,
  ShapeMembers,
  TripleConstraintMembers,
} from '../common/members';

import {
  generateShapeExport,
  generateEnumName,
  generateEnumExport,
  generateExpressions,
  generateTripleConstraint,
  generateValueExpression,
  generateTsType,
  generateCommentFromAnnotations,
  generateExtras,
  putInBraces,
  generateShape,
  generateNameContextsExport,
  generateRdfImport,
} from './generates';
import { addUniqueInlineEnums, reduceInlineEnums } from './inlineEnumHelpers';
import { mapEachOfExpression, mapOneOfExpressions } from './mapExpressions';
import {
  predicateToNameContext,
  reduceNameContexts,
} from './nameContextHelpers';

import { Visitor, ShExVisitorIface } from '@shexjs/visitor';

interface ITypescriptVisitor extends ShExVisitorIface {
  generateImports: (config: CustomImportConfig) => any[];
  _visitValue: (v: any[]) => string;
  _expect: (v: any, t: string, m: string) => void;
}

const TypescriptVisitor: ITypescriptVisitor = Visitor() as ITypescriptVisitor;

TypescriptVisitor.generateImports = ({ customRdfImport }: CustomImportConfig) => {
  return [generateRdfImport(customRdfImport)];
};

TypescriptVisitor._visitValue = function (v: any[]) {
  return Array.isArray(v) ? (v.length > 1 ? v.join('\n') : v.join('')) : v;
};

TypescriptVisitor.visitSchema = function (schema: any, fileName: string) {
  this._expect(schema, 'type', 'Schema');
  const shapeDeclarations = this.visitShapes(
    schema['shapes'],
    schema._prefixes,
    fileName,
  );
  return shapeDeclarations;
};

TypescriptVisitor.visitExpression = function (expr: any, context?: any) {
  if (typeof expr === 'string') return this.visitInclusion(expr);
  const visited =
    expr.type === 'TripleConstraint'
      ? this.visitTripleConstraint(expr, context)
      : expr.type === 'OneOf'
        ? this.visitOneOf(expr, context)
        : expr.type === 'EachOf'
          ? this.visitEachOf(expr, context)
          : null;
  if (visited === null) throw Error('unexpected expression type: ' + expr.type);
  else return visited;
};

TypescriptVisitor.visitOneOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) =>
      mapOneOfExpressions(
        this,
        expression,
        context,
        expression.predicate &&
        findDuplicateIdentifier(
          expr.expressions.map((expr: any) => expr.predicate).filter(Boolean),
          expression.predicate,
        ),
      ),
    ),
  };

  visited.generated = generateExpressions(visited.expressions, ' | ');
  visited.extras = generateExtras(visited.expressions);
  visited.generatedToCreate = generateExpressions(
    visited.expressions,
    ' | ',
    true,
  );
  visited.extrasToCreate = generateExtras(visited.expressions, undefined, true);
  visited.inlineEnums = reduceInlineEnums(visited.expressions);
  visited.nameContext = reduceNameContexts(visited.expressions);

  return visited;
};

TypescriptVisitor.visitEachOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) =>
      mapEachOfExpression(
        this,
        expression,
        context,
        expression.predicate &&
        findDuplicateIdentifier(
          expr.expressions.map((expr: any) => expr.predicate).filter(Boolean),
          expression.predicate,
        ),
      ),
    ),
  };

  const generatedExpressions = generateExpressions(visited.expressions);
  visited.generated = generatedExpressions && putInBraces(generatedExpressions);
  visited.extras = generateExtras(visited.expressions);
  const generatedToCreateExpressions = generateExpressions(
    visited.expressions,
    undefined,
    true,
  );
  visited.generatedToCreate =
    generatedToCreateExpressions && putInBraces(generatedToCreateExpressions);
  visited.extrasToCreate = generateExtras(visited.expressions, undefined, true);
  visited.inlineEnums = reduceInlineEnums(visited.expressions);
  visited.nameContext = reduceNameContexts(visited.expressions);

  return visited;
};

TypescriptVisitor.visitTripleConstraint = function (
  expr: any,
  context?: any,
  not?: string,
) {
  const visited = {
    ...expr,
    expression: maybeGenerate(this, expr, TripleConstraintMembers, {
      ...context,
      predicate: expr.predicate,
    }),
  };
  const { valueExpr } = visited.expression;
  const { inlineEnum, inlineEnums } = valueExpr ?? {};

  visited.inlineEnums = inlineEnum ? [inlineEnum] : inlineEnums;
  visited.typeValue = generateValueExpression(valueExpr, context);
  visited.typeValueToCreate = generateValueExpression(valueExpr, context, true);

  const comment = generateCommentFromAnnotations(visited.annotations);
  visited.generated = generateTripleConstraint(
    valueExpr,
    visited.typeValue,
    visited.predicate,
    context.prefixes,
    comment,
    visited.min > 0 || (!visited.min && !visited.max),
    (visited.max === -1 || context?.extra?.includes(visited.predicate)),
    not,
  );
  visited.generatedToCreate = generateTripleConstraint(
    valueExpr,
    visited.typeValueToCreate,
    visited.predicate,
    context.prefixes,
    comment,
    visited.min > 0 || (!visited.min && !visited.max),
    (visited.max === -1 || context?.extra?.includes(visited.predicate)),
    not,
  );

  if (valueExpr?.generatedShape) {
    visited.nameContext = {
      ...valueExpr.nameContext,
      ...predicateToNameContext(expr, context?.prefixes, not),
    };
  } else {
    visited.nameContext = predicateToNameContext(expr, context?.prefixes, not);
  }

  if (context?.extra?.includes(visited.predicate) && !valueExpr.values) {
    visited.extra = visited.generated;
    visited.extraToCreate = visited.generatedToCreate;
    visited.generated = '';
    visited.generatedToCreate = '';
  }

  return visited;
};

TypescriptVisitor.visitNodeConstraint = function (shape: any, context: any) {
  this._expect(shape, 'type', 'NodeConstraint');

  const visited: Record<string, any> = {
    expression: maybeGenerate(this, shape, NodeConstraintMembers, context),
  };

  if (visited.expression.values) {
    if (visited.expression.values[0].type === 'IriStem') {
      const stem = visited.expression.values[0].stem;
      visited.typeValue = `\`${stem + (stem.endsWith('/') ? '' : '/')
        }\${string}\``;
    } else {
      visited.typeValue = generateEnumName(
        context.id as string,
        context.predicate,
      );
      visited.inlineEnum = {
        [visited.typeValue]: [
          ...visited.expression.values,
          ...(context.inlineEnums
            ? context.inlineEnums[visited.typeValue]
            : []),
        ],
      };
    }
  } else {
    visited.typeValue = generateTsType(visited.expression);
    visited.typeValueToCreate = generateTsType(visited.expression, true);
  }

  return visited;
};

TypescriptVisitor.visitShape = function (shape: any, context: any) {
  this._expect(shape, 'type', 'Shape');
  shape.expression.expressions = normalizeDuplicateProperties(
    shape.expression.expressions,
  );

  const visited = maybeGenerate(this, shape, ShapeMembers, { ...context, extra: shape.extra });
  const {
    generated,
    generatedToCreate,
    extras,
    extrasToCreate,
    extra,
    extraToCreate,
    inlineEnums,
    type,
    nameContext,
  } = visited.expression;

  // look for extras
  const generatedExtras = extras ?? (extra && putInBraces(extra));
  const generatedExtrasToCreate =
    extrasToCreate ?? (extraToCreate && putInBraces(extraToCreate));

  // generate shape from visited expression
  const generatedShape = generateShape(type, generated, generatedExtras);

  // generate shape to create with from visited expression
  const generatedShapeToCreate = generateShape(
    type,
    generatedToCreate,
    generatedExtrasToCreate,
    true,
  );

  return {
    ...visited,
    generatedShape,
    generatedShapeToCreate,
    inlineEnums,
    nameContext,
  };
};

TypescriptVisitor.visitShapeDecl = function (shapeDecl: any, prefixes: any) {
  return this.visitShape(
    { id: shapeDecl.id, ...shapeDecl.shapeExpr },
    { id: shapeDecl.id, prefixes },
  );
};

TypescriptVisitor.visitShapes = function (shapes: any[], prefixes: any) {
  if (shapes === undefined) return undefined;
  const nameContexts: Record<string, string>[] = [];
  let inlineEnums: Record<string, any[]> = {};

  const visited = shapes.map((shape: any) => {
    if (shape.values) {
      generateEnumExport('', shape.values, prefixes, shape.id);
    }

    const visitedShape = this.visitShapeDecl({ ...shape }, prefixes);

    if (visitedShape.inlineEnums) {
      inlineEnums = addUniqueInlineEnums(inlineEnums, visitedShape.inlineEnums);
    }

    nameContexts.push({ id: visitedShape.id, ...visitedShape.nameContext });

    return { id: shape.id, ...visitedShape };
  });

  const generatedShapes = visited.map((shape: any | string) => {
    if (typeof shape === 'string') {
      return shape;
    } else {
      const normalizedUrl = normalizeUrl(shape.id, true);
      return [
        generateShapeExport(normalizedUrl, shape.generatedShape),
        generateShapeExport(
          normalizedUrl + 'CreateArgs',
          shape.generatedShapeToCreate,
        ),
        generateShapeExport(
          normalizedUrl + 'UpdateArgs',
          `Partial<${normalizedUrl + 'CreateArgs'}>`,
        ),
      ].join('\n');
    }
  });

  const generatedNameContexts = generateNameContextsExport(nameContexts);

  const generatedInlineEnums = Object.keys(inlineEnums).map((key) =>
    generateEnumExport(key, inlineEnums[key], prefixes),
  );

  return [
    ...generatedShapes,
    ...generatedInlineEnums,
    ...generatedNameContexts,
  ];
};

function maybeGenerate(
  Visitor: any,
  obj: any,
  members: string[],
  context?: any,
) {
  const generated: Record<string, any> = {};
  members.forEach(function (member) {
    const methodName =
      'visit' + member.charAt(0).toUpperCase() + member.slice(1);
    if (member in obj) {
      const f = Visitor[methodName];
      if (typeof f !== 'function') {
        throw Error(methodName + ' not found in Visitor');
      }
      const t = f.call(
        Visitor,
        obj[member],
        context ?? {
          id: obj?.id,
          prefixes: obj?.prefixes,
          extra: obj?.extra,
        },
      );
      if (t !== undefined) {
        generated[member] = t;
      }
    }
  });
  return generated;
}

export default TypescriptVisitor as ITypescriptVisitor;
