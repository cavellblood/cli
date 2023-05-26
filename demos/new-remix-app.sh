#! /usr/bin/env bash

# include helpers
DIR_PATH="$(dirname "$0")"
source $DIR_PATH/helpers.sh

clear
print_and_wait "Let's generate a new remix app"
run_demo new-remix-app/init.json

step "Now we can start developing our app"
run_demo new-remix-app/dev.json

step "We can now make a change to the shopify.app.dropshipping-dev.toml"
ORIGINAL_TOML=$(cat << 'EOL'
scopes = "write_products"

[settings]
api_key = "384f1ddba5120d2622af435ebbabacbe"

[config]
webhook_event_version = "2023-01"
EOL
)
MODIFIED_TOML=$(cat << 'EOL'
scopes = "write_products"

[settings]
api_key = "384f1ddba5120d2622af435ebbabacbe"

[config]
webhook_event_version = "2023-04"
EOL
)
fake_diff "$ORIGINAL_TOML" "$MODIFIED_TOML"

step "And push the config change to Shopify"
run_demo new-remix-app/push.json

step "What if we wanted to link an existing app to this codebase?"
run_demo new-remix-app/link-production.json

step "Here is how that shopify.app.dropshipping.toml would look like"
PRODUCTION_TOML=$(cat << 'EOL'
scopes = "write_products"

[settings]
api_key = "8614c837eefe0236fc3d2eb6c9841206"

[config]
webhook_event_version = "2023-01"

[config.urls]
app_url = "https://my-cool-dropshipping-app.fly.io"
EOL
)
echo "$PRODUCTION_TOML"

step "We can make a change to it"
MODIFIED_PRODUCTION_TOML=$(cat << 'EOL'
scopes = "write_products"

[settings]
api_key = "8614c837eefe0236fc3d2eb6c9841206"

[config]
webhook_event_version = "2023-04"

[config.urls]
app_url = "https://my-cool-dropshipping-app-v2.fly.io"
EOL
)
fake_diff "$PRODUCTION_TOML" "$MODIFIED_PRODUCTION_TOML"

step "And push the change to Shopify"
run_demo new-remix-app/push-production.json

step "What happens when we deploy?"
run_demo new-remix-app/deploy.json

step "Fin"
