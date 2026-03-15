export const getDefaultDate = () => {
  return new Date().toISOString();
};

export const getFormattedDateForInput = (isoString?: string) => {
  if (!isoString) return new Date().toISOString().slice(0, 10);
  return isoString.slice(0, 10);
};

export const parseDateFromInput = (baseDateStr: string, newYMD: string) => {
  if (!baseDateStr || baseDateStr.length <= 10) {
    if (!newYMD) return newYMD;
    return newYMD + new Date().toISOString().slice(10);
  }
  return newYMD + baseDateStr.slice(10);
};
