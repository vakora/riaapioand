import {put, call, takeEvery, select} from 'redux-saga/effects';
import moment from 'moment';
import {showMessage} from 'react-native-flash-message';
import * as Actions from './constants';
import {getCoupons} from './service';
import {selectCartList} from './selectors';
import {handleError} from 'src/utils/error';
import {addCart, checkItemAddCart} from './helper';

/**
 * Add to cart saga
 * @returns {IterableIterator<*>}
 */
function* addToCartSaga({payload}) {
  let line_items = yield select(selectCartList);
  const {item, cb} = payload;
  const {status, message} = yield call(checkItemAddCart, line_items, item);
  if (!status) {
    const {product} = item;
    const notification = message
      ? {
          message: 'عدم امکان تغییر تعداد',
          description: 'موجودی فروشگاه به اتمام رسیده است.',
        }
      : {
          message: ` شما نمیتوانید مورد دیگیری از${product.get('name')}.را به سبد خرید اضافه کنید `
        };
    yield call(showMessage, {
      ...notification,
      type: 'danger',
    });
  } else {
    const {product} = item;
    line_items = addCart(line_items, item);
    showMessage({
      message: `"${product.get('name')}" با موفقیت به سبد خرید اضافه شد.`,
      type: 'success',
    });
    yield put({
      type: Actions.ADD_TO_CART_VALIDATED,
      payload: line_items,
    });
    yield call(cb);
  }
}

/**
 * Add list to cart saga
 * @returns {IterableIterator<*>}
 */
function* addListToCartSaga({payload}) {
  const line_items = yield select(selectCartList);
  let data = line_items;
  const dataList = payload.map(item => {
    const {status, message} = checkItemAddCart(line_items, item);
    if (!status) {
      return {
        status: false,
        message,
      };
    } else {
      data = addCart(data, item);
      const {product} = item;
      return {
        status: true,
        name: product.get('name'),
      };
    }
  });
  const filterSuccess = dataList.filter(v => v.status);
  let name = '';
  if (filterSuccess.length > 0) {
    const arrayName = filterSuccess.map(v => v.name);
    name = arrayName.join(' and ');
  }

  if (!data.equals(line_items)) {
    showMessage({
      message: `"${name}" با موفقیت به سبد خرید اضافه شد. `,
      type: 'success',
    });
    yield put({
      type: Actions.ADD_TO_CART_VALIDATED,
      payload: data,
    });
  }
}

function* addCouponSaga({payload}) {
  try {
    const data = yield call(getCoupons, {code: payload.code});
    let checkCoupon = true;
    if (!data || data.length < 1) {
      checkCoupon = false;
    } else {
      const coupon = data[0];
      if (
        moment(coupon.date_expires).isBefore(moment()) ||
        (coupon.usage_count &&
          coupon.usage_limit &&
          coupon.usage_count === coupon.usage_limit)
      ) {
        checkCoupon = false;
      }
    }
    if (!checkCoupon) {
      yield call(handleError, {
        message: 'لطفا کد مورد نظر را دوباره بررسی کنید!',
      });
    } else {
      yield put({
        type: Actions.ADD_COUPON_SUCCESS,
        payload: payload,
      });
    }
  } catch (e) {
    yield call(handleError, e);
  }
}
export default function* cartSaga() {
  yield takeEvery(Actions.ADD_TO_CART, addToCartSaga);
  yield takeEvery(Actions.ADD_TO_CART_LIST, addListToCartSaga);
  yield takeEvery(Actions.ADD_COUPON, addCouponSaga);
}
