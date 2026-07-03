export const formatDateToLabel = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const month = months[parseInt(parts[1], 10) - 1];
  return `${day} de ${month}`;
};
