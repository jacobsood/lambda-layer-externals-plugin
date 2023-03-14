# Creating Hooks

1. Create a bash script that performs the hook actions required, within the `hooks` directory


2. Test the script. Import the common script if needed.
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
   # shellcheck source=_common.sh
   . "$SCRIPT_DIR/_common.sh"
   ```
   
3. Call the script from within `pre-commit` or `pre-push`. e.g.,

   ```bash
   . "$(dirname -- "$0")/hooks/terragrunt-fmt.sh"
   ```
