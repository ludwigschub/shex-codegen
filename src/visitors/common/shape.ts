export function normalizeDuplicateProperties(expressions: any[]) {
  return expressions?.reduce(
    (currentExpressions: any[], currentExpression: any) => {
      const duplicate = currentExpressions?.find(
        (expression) => expression.predicate === currentExpression.predicate
      );
      return duplicate && duplicate.valueExpr && currentExpression.valueExpr
        ? [
            ...currentExpressions.filter(
              (expression) => expression.predicate !== duplicate.predicate
            ),
            {
              ...currentExpression,
              valueExpr:
                duplicate.valueExpr?.values &&
                currentExpression.valueExpr?.values
                  ? {
                      ...duplicate.valueExpr,
                      values: [
                        ...duplicate.valueExpr.values,
                        ...currentExpression.valueExpr.values,
                      ],
                    }
                  : currentExpression.valueExpr,
            },
          ]
        : [...currentExpressions, currentExpression];
    },
    []
  );
}
