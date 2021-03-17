"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const parser_1 = __importDefault(require("@shexjs/parser"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const findit_1 = __importDefault(require("findit"));
const typescript_1 = __importDefault(require("./visitors/typescript"));
const generate = async (dir, outDir, suffix) => {
    const finder = findit_1.default(dir ?? process.cwd());
    //This listens for files found
    finder.on("file", function (file) {
        if (file.endsWith(suffix ?? "shex")) {
            readAndGenerateShex(file, outDir);
        }
    });
};
exports.generate = generate;
const readAndGenerateShex = async (file, outDir) => {
    // Read shape file
    const shapeFile = fs_1.readFileSync(file, { encoding: "utf8" });
    // Parse shape
    const parser = parser_1.default.construct("https://shaperepo.com/schemas/solidProfile#", null, { index: true });
    const shapeSchema = parser.parse(shapeFile);
    const types = typescript_1.default.visitSchema(shapeSchema);
    await writeShapeFile(file, types, outDir);
};
const writeShapeFile = (file, content, outDir) => {
    return new Promise((resolve, reject) => {
        const generatedDir = path_1.default.join(process.cwd(), outDir ?? "/generated/");
        if (!fs_1.existsSync(generatedDir)) {
            fs_1.mkdirSync(generatedDir);
        }
        fs_1.writeFile(path_1.default.join(generatedDir, `${getFileName(file)}.ts`), content, "binary", (err) => (err ? reject(err) : resolve()));
    });
};
const getFileName = (file) => path_1.default.parse(file).name;
//# sourceMappingURL=generate.js.map