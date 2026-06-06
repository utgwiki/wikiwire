import fs from 'node:fs';
import TOML from '@iarna/toml';

export type site_config = {
  id: string;
  site: string;
  api: string;
  dry_run: boolean;
  default_branch: string | null;
  css_content_model: string;
};

export type group_config = {
  id: string;
  sites: string[];
};

type toml_site_entry = {
  id?: unknown;
  site?: unknown;
  api?: unknown;
  dry_run?: unknown;
  default_branch?: unknown;
  css_content_model?: unknown;
};

type toml_group_entry = {
  id?: unknown;
  sites?: unknown;
};

type toml_root = {
  version?: unknown;
  shared?: unknown;
  sites?: unknown;
  groups?: unknown;
};

export function load_config(config_path: string): {
  version: number;
  shared: boolean;
  sites: Map<string, site_config>;
  path_to_site: Map<string, site_config>;
  groups: Map<string, group_config>;
} {
  const raw = fs.readFileSync(config_path, 'utf8');
  const data = TOML.parse(raw) as toml_root;

  if (!Array.isArray(data.sites)) {
    throw new Error('WikiWire: wikiwire.toml must contain [[sites]] entries');
  }

  const shared = Boolean(data.shared);

  const sites = new Map<string, site_config>();
  const path_to_site = new Map<string, site_config>();

  for (const entry of data.sites) {
    const s = entry as toml_site_entry;

    if (typeof s.id !== 'string' || typeof s.api !== 'string') {
      throw new Error('WikiWire: each site needs string id and api');
    }

    const trimmed_id = s.id.trim();
    if (trimmed_id.length === 0) {
      throw new Error('WikiWire: site id must not be empty or whitespace-only');
    }

    const trimmed_api = s.api.trim();
    if (trimmed_api.length === 0) {
      throw new Error(`WikiWire: site "${trimmed_id}" api must not be empty or whitespace-only`);
    }

    let path_segment = trimmed_id;
    if (s.site !== undefined && s.site !== null) {
      if (typeof s.site !== 'string') {
        throw new Error(`WikiWire: site "${trimmed_id}" site must be a string if set`);
      }

      path_segment = s.site.trim();
      if (path_segment.length === 0) {
        throw new Error(`WikiWire: site "${trimmed_id}" site must not be empty`);
      }
    }

    const site_cfg: site_config = {
      id: trimmed_id,
      site: path_segment,
      api: trimmed_api,
      dry_run: Boolean(s.dry_run),
      default_branch: typeof s.default_branch === 'string' ? s.default_branch : null,
      css_content_model:
        typeof s.css_content_model === 'string' ? s.css_content_model : 'sanitized-css',
    };

    if (path_segment === 'shared') {
      throw new Error(
        `WikiWire: site "${trimmed_id}" cannot use path segment "shared" (reserved for modules/shared and templates/shared)`,
      );
    }

    if (path_segment === 'groups') {
      throw new Error(
        `WikiWire: site "${trimmed_id}" cannot use path segment "groups" (reserved for groups feature)`,
      );
    }

    if (sites.has(site_cfg.id)) {
      throw new Error(`WikiWire: duplicate site id "${site_cfg.id}" in configuration`);
    }

    if (path_to_site.has(path_segment)) {
      const other = path_to_site.get(path_segment);
      throw new Error(
        `WikiWire: duplicate repo path segment "${path_segment}" (sites "${other?.id}" and "${site_cfg.id}")`,
      );
    }

    sites.set(site_cfg.id, site_cfg);
    path_to_site.set(path_segment, site_cfg);
  }

  const groups = new Map<string, group_config>();
  if (Array.isArray(data.groups)) {
    for (const entry of data.groups) {
      const g = entry as toml_group_entry;
      if (typeof g.id !== 'string' || !Array.isArray(g.sites)) {
        throw new Error('WikiWire: each group needs string id and array of sites');
      }

      const group_id = g.id.trim();
      if (group_id.length === 0) {
        throw new Error('WikiWire: group id must not be empty');
      }

      if (group_id === 'shared' || group_id === 'groups') {
          throw new Error(`WikiWire: group id cannot be "${group_id}" (reserved)`);
      }

      const group_sites: string[] = [];
      const seen_sites = new Set<string>();
      for (const s of g.sites) {
        if (typeof s !== 'string') {
          throw new Error(`WikiWire: group "${group_id}" site list must contain strings`);
        }
        if (!sites.has(s)) {
          throw new Error(`WikiWire: group "${group_id}" references unknown site "${s}" (site not defined in [[sites]])`);
        }
        if (seen_sites.has(s)) {
          throw new Error(`WikiWire: group "${group_id}" contains duplicate site "${s}"`);
        }
        seen_sites.add(s);
        group_sites.push(s);
      }

      if (groups.has(group_id)) {
        throw new Error(`WikiWire: duplicate group id "${group_id}"`);
      }

      if (path_to_site.has(group_id)) {
           throw new Error(`WikiWire: group id "${group_id}" conflicts with a site path segment`);
      }

      groups.set(group_id, {
        id: group_id,
        sites: group_sites,
      });
    }
  }

  if (sites.size === 0) {
    throw new Error('WikiWire: wikiwire.toml must define at least one [[sites]] entry');
  }

  return {
    version: typeof data.version === 'number' ? data.version : 1,
    shared,
    sites,
    path_to_site,
    groups,
  };
}
