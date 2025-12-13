import { customAlphabet } from 'nanoid';

const order = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5);

const referral = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

export const orderID = function generateOrderId () {
    return `ORD-${order()}-${order()}`;
}

export const referralCode = function generateReferralCode () {
    return `K4U-${referral()}`
}
