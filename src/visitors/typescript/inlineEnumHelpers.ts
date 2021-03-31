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

export function reduceInlineEnums(expressions: any[]) {
  const inlineEnums = expressions
    .filter((expression: any) => {
      return !!expression.inlineEnums;
    })
    .reduce(
      (inlineEnums: any, expression: any) =>
        expression.inlineEnums
          ? [...inlineEnums, ...expression.inlineEnums]
          : inlineEnums,
      []
    );

  if (Object.keys(inlineEnums).length > 0) {
    return inlineEnums;
  }
}
