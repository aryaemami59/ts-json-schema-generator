/**
 * Abstract base for all internal types produced by the node-parser pipeline.
 * Every concrete type (e.g. {@linkcode StringType}, {@linkcode ObjectType})
 * extends this class and implements {@linkcode BaseType.getId | getId()}.
 */
export abstract class BaseType {
    /**
     * Returns a stable, unique string identifier for this type instance. Used
     * as cache keys in {@linkcode ChainNodeParser} and as `$ref` targets in
     * {@linkcode SchemaGenerator}.
     *
     * @returns a stable, unique string identifier for this type instance. Used as cache keys in {@linkcode ChainNodeParser} and as `$ref` targets in {@linkcode SchemaGenerator}.
     */
    public abstract getId(): string;

    /**
     * Returns the definition name used in `definitions`. Override in non-basic
     * types (e.g. {@linkcode DefinitionType}).
     *
     * @returns The definition name used in `definitions`. Override in non-basic types (e.g. {@linkcode DefinitionType})., defaulting to {@linkcode BaseType.getId | getId()}.
     */
    public getName(): string {
        return this.getId();
    }
}
