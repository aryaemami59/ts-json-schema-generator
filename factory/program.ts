import { globSync } from "glob";
import * as path from "node:path";
import normalize from "normalize-path";
import ts from "typescript";
import type { CompletedConfig, Config } from "../src/Config.js";
import { BuildError } from "../src/Error/Errors.js";

/**
 * Reads and parses a `tsconfig.json` file from disk, applying emit-related
 * options that are irrelevant to schema generation setting
 * {@linkcode https://www.typescriptlang.org/tsconfig/#noEmit | noEmit} to
 * `true` and deleting the following options if present:
 *
 * - {@linkcode https://www.typescriptlang.org/tsconfig/#out | out}
 * - {@linkcode https://www.typescriptlang.org/tsconfig/#outDir | outDir}
 * - {@linkcode https://www.typescriptlang.org/tsconfig/#outFile | outFile}
 * - {@linkcode https://www.typescriptlang.org/tsconfig/#declaration | declaration}
 * - {@linkcode https://www.typescriptlang.org/tsconfig/#declarationDir | declarationDir}
 * - {@linkcode https://www.typescriptlang.org/tsconfig/#declarationMap | declarationMap}
 *
 * @param configFile - Absolute or relative path to the tsconfig file.
 * @returns Parsed command-line result with {@linkcode ts.ParsedCommandLine.fileNames | fileNames} and {@linkcode ts.ParsedCommandLine.options | options}.
 * @throws A {@linkcode BuildError} if the file cannot be read, parsed, or is structurally invalid.
 */
function loadTsConfigFile(configFile: string) {
    const raw = ts.sys.readFile(configFile);

    if (!raw) {
        throw new BuildError({
            messageText: `Cannot read config file "${configFile}"`,
        });
    }

    const config = ts.parseConfigFileTextToJson(configFile, raw);

    if (config.error) {
        throw new BuildError(config.error);
    }

    if (!config.config) {
        throw new BuildError({
            messageText: `Invalid parsed config file "${configFile}"`,
        });
    }

    const parseResult = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        path.resolve(path.dirname(configFile)),
        {},
        configFile,
    );
    parseResult.options.noEmit = true;
    delete parseResult.options.out;
    delete parseResult.options.outDir;
    delete parseResult.options.outFile;
    delete parseResult.options.declaration;
    delete parseResult.options.declarationDir;
    delete parseResult.options.declarationMap;

    return parseResult;
}

/**
 * Resolves the TypeScript compiler options and root file list for the given
 * {@linkcode Config}. When {@linkcode Config.tsconfig | tsconfig} is provided,
 * the file is loaded via {@linkcode loadTsConfigFile}; otherwise a minimal set
 * of built-in defaults is returned.
 *
 * @see {@linkcode Config.tsconfig} for details.
 *
 * @param config - The user-supplied (possibly incomplete) config.
 * @returns A `{ fileNames, options }` pair suitable for {@linkcode ts.createProgram}.
 */
function getTsConfig(config: Config): Pick<ts.ParsedCommandLine, "fileNames" | "options"> {
    if (config.tsconfig) {
        return loadTsConfigFile(config.tsconfig);
    }

    return {
        fileNames: [],
        options: {
            noEmit: true,
            emitDecoratorMetadata: true,
            experimentalDecorators: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            strictNullChecks: false,
            skipLibCheck: true,
            skipDefaultLibCheck: true,
            esModuleInterop: true,
            types: ["node"],
        },
    };
}

/**
 * Creates a TypeScript {@linkcode ts.Program} from the resolved configuration.
 * Globs source files from {@linkcode Config.path | config.path} when provided,
 * falling back to the tsconfig file list. Optionally runs the TypeScript
 * type-checker before returning.
 *
 * @example
 * <caption>Create a program from a glob path</caption>
 *
 * ```ts
 * import { createProgram } from 'ts-json-schema-generator';
 * import { DEFAULT_CONFIG } from 'ts-json-schema-generator';
 *
 * const program = createProgram({
 *   ...DEFAULT_CONFIG,
 *   path: 'src/‎**‎/*.ts',
 * });
 * ```
 *
 * @param config - The completed generator configuration.
 * @returns A compiled {@linkcode ts.Program}.
 * @throws A {@linkcode BuildError} if no input files are found.
 * @throws A {@linkcode BuildError} if type-checking fails and {@linkcode Config.skipTypeCheck | config.skipTypeCheck} is `false`.
 *
 * @see {@linkcode Config.path}
 * @see {@linkcode Config.tsconfig}
 * @see {@linkcode Config.skipTypeCheck}
 */
export function createProgram(config: CompletedConfig): ts.Program {
    // TODO: Switch back to node:fs globSync once Node 20 is EOL (https://github.com/vega/ts-json-schema-generator/issues/2461).
    const rootNamesFromPath = config.path
        ? globSync(normalize(path.resolve(config.path))).map((rootName) => normalize(rootName))
        : [];
    const tsconfig = getTsConfig(config);
    const rootNames = rootNamesFromPath.length ? rootNamesFromPath : tsconfig.fileNames;

    if (!rootNames.length) {
        throw new BuildError({
            messageText: "No input files",
        });
    }

    const program: ts.Program = ts.createProgram(rootNames, tsconfig.options);

    if (!config.skipTypeCheck) {
        const diagnostics = ts.getPreEmitDiagnostics(program);

        if (diagnostics.length) {
            throw new BuildError({
                messageText: "Type check error",
                relatedInformation: [...diagnostics],
            });
        }
    }

    return program;
}
