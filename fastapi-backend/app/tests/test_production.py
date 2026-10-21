import unittest

from sqlalchemy.engine import make_url

from app.core.config import Settings, validate_production


class ProductionSettingsTests(unittest.TestCase):
    def settings(self, **overrides):
        return Settings(
            _env_file=None,
            **{
                "app_env": "production",
                "jwt_secret": "a" * 48,
                "database_url": "postgresql://test:password@db/test",
                "allowed_origins": "https://cubesat.p-tech.xyz",
                "mqtt_password": "test-password",
                **overrides,
            },
        )

    def test_strong_production_configuration_and_development_remain_valid(self):
        validate_production(self.settings())
        validate_production(Settings(_env_file=None, app_env="development"))

    def test_incomplete_settings_fail_without_exposing_values(self):
        for overrides in [
            {"jwt_secret": "change_me"},
            {"jwt_secret": "replace_" + "x" * 40},
            {"database_url": ""},
            {"database_url": "postgresql://test:<PASSWORD>@<DB_HOST>/test"},
            {"database_url": "postgresql:///test"},
            {"allowed_origins": "*"},
            {"allowed_origins": "http://cubesat.p-tech.xyz"},
            {"allowed_origins": "https://cubesat.p-tech.xyz/path"},
            {"allowed_origins": "https://*.p-tech.xyz"},
            {"allowed_origins": "https://user:password@cubesat.p-tech.xyz"},
            {"mqtt_password": "<BROKER_SERVICE_PASSWORD>"},
        ]:
            with self.subTest(overrides=list(overrides)), self.assertRaises(RuntimeError):
                validate_production(self.settings(**overrides))

    def test_settings_repr_hides_database_jwt_and_broker_passwords(self):
        rendered = repr(self.settings())
        self.assertNotIn("postgresql://", rendered)
        self.assertNotIn("a" * 48, rendered)
        self.assertNotIn("test-password", rendered)

    def test_structured_database_password_is_url_encoded_and_hidden(self):
        password = "p@ss:/?#% +$'word"
        settings = self.settings(
            database_url="", database_host="postgres", database_password=password
        )
        url = make_url(settings.async_database_url)
        self.assertEqual(url.password, password)
        self.assertEqual(url.host, "postgres")
        self.assertEqual(url.port, 5432)
        self.assertEqual(url.database, "cubesat")
        self.assertNotIn(password, repr(settings))
        validate_production(settings)

    def test_explicit_database_url_takes_precedence_over_structured_defaults(self):
        settings = self.settings(database_host="postgres", database_password="unused")
        self.assertEqual(make_url(settings.async_database_url).host, "db")
