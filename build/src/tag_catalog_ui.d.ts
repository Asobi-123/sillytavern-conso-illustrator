/**
 * Built-in + user tag catalog browser.
 *
 * Runtime never fetches network resources. Built-in entries ship with the
 * extension; user entries are stored in extension settings and merged locally.
 */
export declare function createTagCatalogContent(): string;
export declare function initializeTagCatalog(settings: AutoIllustratorSettings, saveFn: () => void): void;
