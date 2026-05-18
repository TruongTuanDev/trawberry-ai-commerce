import os


TEST_ENV_DEFAULTS = {
    "ENVIRONMENT": "test",
    "AI_IMAGE_PROVIDER": "mock",
    "OPENAI_API_KEY": "",
    "RUN_OPENAI_SMOKE": "false",
    "STORAGE_DRIVER": "mock",
    "STORAGE_LOCAL_ROOT": "generated-test",
    "STORAGE_PUBLIC_BASE_URL": "http://testserver/generated",
    "S3_ENDPOINT": "",
    "S3_ENDPOINT_URL": "",
    "S3_ACCESS_KEY_ID": "",
    "S3_SECRET_ACCESS_KEY": "",
    "S3_PUBLIC_BASE_URL": "",
}


for key, value in TEST_ENV_DEFAULTS.items():
    os.environ[key] = value
