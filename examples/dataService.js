export default {
  processData(data) {
    if (!Array.isArray(data)) return data;

    return data.reduce((prev, curr) => prev + curr, 0);
  }
}