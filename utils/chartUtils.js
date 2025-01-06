// Helper function to get date range based on selected option
const getDateRange = async (dateRange, filterDate) => {
  try {
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      case "custom":
        startDate = new Date(filterDate);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
        break;
    }

    return { startDate, endDate };
  } catch (error) {
      console.error('Error fetching date range: ', error);
      throw new Error("An error occurred. Please try again later.");
  }
}

module.exports = getDateRange;