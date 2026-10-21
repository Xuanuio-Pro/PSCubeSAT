import unittest
from unittest.mock import patch

import httpx

from scripts.check_server_http import check_endpoint


class DeploymentHttpTests(unittest.TestCase):
    def test_rejects_gateway_error_instead_of_reporting_a_successful_deploy(self):
        with patch("scripts.check_server_http.httpx.get", return_value=httpx.Response(502)):
            with self.assertRaisesRegex(RuntimeError, "Nginx.*502"):
                check_endpoint("Nginx", "http://frontend")

    def test_rejects_spa_html_even_when_the_status_is_200(self):
        response = httpx.Response(200, text="<!doctype html><title>CubeSAT</title>")
        with patch("scripts.check_server_http.httpx.get", return_value=response):
            with self.assertRaisesRegex(RuntimeError, "expected JSON"):
                check_endpoint("Nginx", "http://frontend")

    def test_google_can_be_disabled_while_the_config_api_is_healthy(self):
        response = httpx.Response(200, json={"client_id": ""})
        with (
            patch("scripts.check_server_http.httpx.get", return_value=response),
            patch("builtins.print") as output,
        ):
            check_endpoint("Nginx", "http://frontend")
        self.assertIn("HTTP 200", output.call_args.args[0])
