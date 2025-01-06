const calculateSubTotal = (cart) => {
 return cart.items.reduce((acc, item) => {
    const price = item.productId.discountPrice || item.price;
    return acc + (price * item.quantity);
 }, 0);
};

const calculateCouponDiscount = (coupon, subTotal) => {
    if (!coupon) return 0;
    return coupon.type === 'PERCENTAGE'
        ? subTotal * (coupon.discountValue / 100)
        : coupon.discountValue;
};

const recalculateCartTotals = (cart) => {
    try {
        cart.subTotal = calculateSubTotal(cart);
        cart.couponDiscount = calculateCouponDiscount(cart.couponId, cart.subTotal);
        cart.itemCount = cart.items.length;

        cart.totalPrice = (cart.subTotal - cart.couponDiscount + cart.shippingCharge) || 0;

        cart.subTotal = Number(cart.subTotal);
        cart.couponDiscount = Number(cart.couponDiscount);
        cart.totalPrice = Number(cart.totalPrice);
    } catch (error) {
        console.error('Error recalculating cart totals: ', error);
        throw new Error("An error occurred. Please try again later.");
    }
};


module.exports = {
    calculateSubTotal,
    calculateCouponDiscount,
    recalculateCartTotals,
};