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
