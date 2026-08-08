import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "schemas", "lexicon.schema.json"), "utf8"));
const data = JSON.parse(readFileSync(join(root, "catalog", "lexicon.json"), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(data)) {
  console.error(validate.errors);
  process.exit(1);
}
console.log(`OK: ${Object.keys(data.terms).length} terms, ${data.samples.length} samples`);
