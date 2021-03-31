export function reduceExpressions(expressions: any[]) {
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

export function addUniqueInlineEnums(allInlineEnums: any, newInlineEnums: any) {
  newInlineEnums.forEach((inlineEnum: any) => {
    Object.keys(inlineEnum).forEach((enumKey: string) => {
      if (!allInlineEnums[enumKey]) {
        allInlineEnums[enumKey] = inlineEnum[enumKey];
      } else {
        allInlineEnums[enumKey] = Object.values(
          Object.assign(
            {},
            ...inlineEnum[enumKey].map((value: string) => ({
              [value]: value,
            })),
            ...allInlineEnums[enumKey].map((value: string) => ({
              [value]: value,
            }))
          )
        );
      }
    });
  });

  return allInlineEnums;
}
