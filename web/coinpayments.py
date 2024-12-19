import hmac
import hashlib
from urllib.parse import urlencode
from collections import OrderedDict
import requests
import logging
import traceback
from flask import request

logger = logging.getLogger(__name__)


class CoinPaymentsAPI:
    def __init__(self, public_key, private_key, ipn_secret=None):
        self.public_key = public_key
        self.private_key = private_key
        self.ipn_secret = ipn_secret
        self.url = 'https://www.coinpayments.net/api.php'

    def _make_request(self, cmd, **params):
        """Отправляет запрос к API CoinPayments"""
        params.update({
            'cmd': cmd,
            'key': self.public_key,
            'version': '1',
            'format': 'json',
        })

        param_string = urlencode(params).encode('utf-8')
        hmac_obj = hmac.new(
            self.private_key.encode('utf-8'),
            param_string,
            hashlib.sha512
        )
        hmac_sign = hmac_obj.hexdigest()

        try:
            response = requests.post(self.url, data=params, headers={'HMAC': hmac_sign})
            response.raise_for_status()  # Проверяем статус ответа
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API Request Error: {str(e)}")
            return {'error': 'api_connection_error', 'message': str(e)}

    def create_transaction(self, amount, currency1='USDT.BEP20', currency2='USDT.BEP20', buyer_email=None):
        """Создает новую транзакцию"""
        try:
            params = {
                'amount': amount,
                'currency1': currency1,
                'currency2': currency2,
                'buyer_email': buyer_email or '',
            }

            response = self._make_request('create_transaction', **params)
            logger.info(f"Create transaction response: {response}")
            return response
        except Exception as e:
            logger.error(f"Create Transaction Error: {str(e)}")
            return {'error': 'transaction_creation_error', 'message': str(e)}

    def get_tx_info(self, txid):
        """Получает информацию о транзакции"""
        try:
            response = self._make_request('get_tx_info', txid=txid)
            logger.info(f"Transaction info for {txid}: {response}")
            return response
        except Exception as e:
            logger.error(f"Get Transaction Info Error: {str(e)}")
            return {'error': 'transaction_info_error', 'message': str(e)}

    def verify_ipn(self, form_data):
        """Verify IPN request from CoinPayments"""
        try:
            # Получаем HMAC из формы или заголовков
            hmac_sig = form_data.get('hmac')
            if not hmac_sig:
                hmac_sig = request.headers.get('Hmac')
                logger.info(f"Using HMAC from headers: {hmac_sig}")

            if not hmac_sig:
                logger.error("No HMAC signature found")
                return False

            # Создаем строку для подписи
            params = dict(form_data)
            if 'hmac' in params:
                del params['hmac']

            sorted_params = OrderedDict(sorted(params.items(), key=lambda t: t[0]))
            param_string = urlencode(sorted_params)

            # Вычисляем HMAC
            hmac_obj = hmac.new(
                self.ipn_secret.encode('utf-8'),
                param_string.encode('utf-8'),
                hashlib.sha512
            )
            calculated_hmac = hmac_obj.hexdigest()

            # Сравниваем подписи
            is_valid = hmac.compare_digest(calculated_hmac.lower(), hmac_sig.lower())
            logger.info(f"IPN Validation result: {is_valid}")
            return is_valid

        except Exception as e:
            logger.error(f"IPN Verification Error: {str(e)}")
            traceback.print_exc()
            return False