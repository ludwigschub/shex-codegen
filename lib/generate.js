"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const parser_1 = __importDefault(require("@shexjs/parser"));
const fs_1 = require("fs");
const typescript_1 = __importDefault(require("./visitors/typescript"));
const generate = async () => {
    // Read shape file
    const shapeFile = await new Promise((resolve, reject) => fs_1.readFile("./shapes/solidProfile.shex", "utf8", (err, data) => err ? reject(err) : resolve(data)));
    // Parse shape
    const parser = parser_1.default.construct("https://shaperepo.com/schemas/solidProfile#", null, { index: true });
    const shapeSchema = parser.parse(shapeFile);
    const types = typescript_1.default.visitSchema(shapeSchema);
    await new Promise((resolve, reject) => fs_1.writeFile("./generated/solidProfile.ts", JSON.stringify(types), (err) => err ? reject(err) : resolve()));
};
exports.generate = generate;
//# sourceMappingURL=generate.js.map