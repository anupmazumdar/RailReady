import logging
from config.settings import TRAIN_DATA_PROVIDER
from backend.train_info.providers.base import TrainDataProvider
from backend.train_info.providers.mock_provider import MockTrainDataProvider

logger = logging.getLogger("train_provider_factory")

_singleton_provider: TrainDataProvider = None


def get_train_data_provider() -> TrainDataProvider:
    """
    Factory resolving the active train data provider based on environment settings.
    Defaults to MockTrainDataProvider for 100% offline, zero-scraping safety.
    """
    global _singleton_provider
    if _singleton_provider is None:
        provider_type = TRAIN_DATA_PROVIDER.upper().strip()
        if provider_type == "MOCK":
            _singleton_provider = MockTrainDataProvider()
        elif provider_type == "AUTHORIZED":
            # Reserved for licensed B2B CRIS/IRCTC feed
            logger.info("Authorized provider configured. Fallback to mock simulation if credentials unset.")
            _singleton_provider = MockTrainDataProvider()
        else:
            logger.warning(f"Unknown provider '{provider_type}', falling back to MockTrainDataProvider.")
            _singleton_provider = MockTrainDataProvider()

    return _singleton_provider
