export function pagination(page?: number, take?: number | string) {
  const takeNumber = Math.max(parseInt(take as string, 10) || 10, 1);
  const currentPage = Math.max(page || 1, 1);

  return {
    take: takeNumber,
    skip: (currentPage - 1) * takeNumber,
    currentPage,
  };
}
