const calculateBestDiscountedPrice = (product) => {
  let bestDiscountPrice = product.price;
  let bestDiscountPercentage = 0;
  let bestFixedDiscount = 0;
  let discountType = ""; // 'fixed' or 'percentage'

  // Calculate discount for product-specific offers
  if (product.offer && product.offer.isActive) {
    if (product.offer.fixedDiscount > 0) {
      let productDiscountPrice = product.price - product.offer.fixedDiscount;
      if (productDiscountPrice < bestDiscountPrice) {
        bestDiscountPrice = productDiscountPrice;
        bestFixedDiscount = product.offer.fixedDiscount;
        bestDiscountPercentage =
          (product.offer.fixedDiscount / product.price) * 100;
        discountType = "fixed";
      }
    } else if (product.offer.percentageDiscount > 0) {
      let productDiscountPrice =
        product.price -
        (product.price * product.offer.percentageDiscount) / 100;
      if (productDiscountPrice < bestDiscountPrice) {
        bestDiscountPrice = productDiscountPrice;
        bestFixedDiscount = 0;
        bestDiscountPercentage = product.offer.percentageDiscount;
        discountType = "percentage";
      }
    }
  }

  // Calculate discount for category-specific offers
  if (
    product.category &&
    product.category.offer &&
    product.category.offer.isActive
  ) {
    if (product.category.offer.fixedDiscount > 0) {
      let categoryDiscountPrice =
        product.price - product.category.offer.fixedDiscount;
      if (categoryDiscountPrice < bestDiscountPrice) {
        bestDiscountPrice = categoryDiscountPrice;
        bestFixedDiscount = product.category.offer.fixedDiscount;
        bestDiscountPercentage =
          (product.category.offer.fixedDiscount / product.price) * 100;
        discountType = "fixed";
      }
    } else if (product.category.offer.percentageDiscount > 0) {
      let categoryDiscountPrice =
        product.price -
        (product.price * product.category.offer.percentageDiscount) / 100;
      if (categoryDiscountPrice < bestDiscountPrice) {
        bestDiscountPrice = categoryDiscountPrice;
        bestFixedDiscount = 0;
        bestDiscountPercentage = product.category.offer.percentageDiscount;
        discountType = "percentage";
      }
    }
  }

  return {
    discountedPrice: bestDiscountPrice,
    discountPercentage: bestDiscountPercentage,
    fixedDiscount: bestFixedDiscount,
    discountType: discountType,
  };
};

module.exports = {
  calculateBestDiscountedPrice,
};