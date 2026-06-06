export type mapped_shared = {
  is_shared: true;
  is_group: false;
  title: string;
  content_model: string;
  kind: 'module' | 'template' | 'mediawiki';
};

export type mapped_site = {
  is_shared: false;
  is_group: false;
  title: string;
  content_model: string;
  kind: 'module' | 'template' | 'mediawiki';
};

export type mapped_group = {
  is_shared: false;
  is_group: true;
  group_id: string;
  title: string;
  content_model: string;
  kind: 'module' | 'template' | 'mediawiki';
};

export type mapped_path = mapped_shared | mapped_site | mapped_group;

export function map_repo_path(
  relative_path: string,
  options: { css_content_model?: string } = {},
): mapped_path | null {
  const css_content_model = options.css_content_model ?? 'sanitized-css';
  const normalized = relative_path.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const root = parts[0];
  if (root !== 'modules' && root !== 'templates' && root !== 'mediawiki') return null;

  if (root === 'mediawiki') {
    if (parts[1] === 'groups') {
      if (parts.length < 4) {
        throw new Error(
          `WikiWire: path too shallow (need mediawiki/groups/<group_id>/<file>): ${relative_path}`,
        );
      }
    } else if (parts.length < 3) {
      throw new Error(
        `WikiWire: path too shallow (need mediawiki/<path_segment>/<file>): ${relative_path}`,
      );
    }
  } else {
    // modules or templates
    if (parts[1] === 'groups') {
      if (parts.length < 5) {
        throw new Error(
          `WikiWire: path too shallow (need ${root}/groups/<group_id>/<root_name>/<file>): ${relative_path}`,
        );
      }
    } else if (parts.length < 4) {
      throw new Error(
        `WikiWire: path too shallow (need ${root}/<path_segment>/<root_name>/<file>): ${relative_path}`,
      );
    }
  }

  const path_segment = parts[1];
  const is_shared = path_segment === 'shared';
  const is_group = path_segment === 'groups';

  if (root === 'mediawiki') {
    let rel_under_root: string;
    let group_id: string | undefined;

    if (is_group) {
      group_id = parts[2];
      rel_under_root = parts.slice(3).join('/');
    } else {
      rel_under_root = parts.slice(2).join('/');
    }

    const content_model = content_model_for_repo_subfile(rel_under_root, css_content_model, {
      allow_scribunto: false,
    });

    if (is_group && group_id) {
      return {
        is_shared: false,
        is_group: true,
        group_id,
        title: `MediaWiki:${rel_under_root}`,
        content_model,
        kind: 'mediawiki',
      };
    }

    return {
      is_shared,
      is_group: false,
      title: `MediaWiki:${rel_under_root}`,
      content_model,
      kind: 'mediawiki',
    };
  }

  let root_name: string;
  let rest: string[];
  let group_id: string | undefined;

  if (is_group) {
    group_id = parts[2];
    root_name = parts[3];
    rest = parts.slice(4);
  } else {
    root_name = parts[2];
    rest = parts.slice(3);
  }

  const rel_under_root = rest.join('/');

  if (root === 'modules') {
    if (rel_under_root.endsWith('.template.wikitext')) {
      throw new Error(
        `WikiWire: ${relative_path}: .template.wikitext belongs under templates/, not modules/`,
      );
    }

    let title = '';
    let content_model = '';

    if (rel_under_root === `${root_name}.module.lua`) {
      title = `Module:${root_name}`;
      content_model = 'scribunto';
    } else if (rel_under_root === `${root_name}.module.luau`) {
      title = `Module:${root_name}`;
      content_model = 'scribunto';
    } else if (rel_under_root === 'doc.wikitext') {
      title = `Module:${root_name}/doc`;
      content_model = 'wikitext';
    } else {
      content_model = content_model_for_repo_subfile(rel_under_root, css_content_model, {
        allow_scribunto: true,
      });
      title = `Module:${root_name}/${rel_under_root}`;
    }

    if (is_group && group_id) {
      return {
        is_shared: false,
        is_group: true,
        group_id,
        title,
        content_model,
        kind: 'module',
      };
    }
    return {
      is_shared,
      is_group: false,
      title,
      content_model,
      kind: 'module',
    };
  }

  // root === 'templates'
  let title = '';
  let content_model = '';

  if (rel_under_root === `${root_name}.template.wikitext`) {
    title = `Template:${root_name}`;
    content_model = 'wikitext';
  } else if (rel_under_root === 'doc.wikitext') {
    title = `Template:${root_name}/doc`;
    content_model = 'wikitext';
  } else {
    content_model = content_model_for_repo_subfile(rel_under_root, css_content_model, {
      allow_scribunto: false,
    });
    title = `Template:${root_name}/${rel_under_root}`;
  }

  if (is_group && group_id) {
    return {
      is_shared: false,
      is_group: true,
      group_id,
      title,
      content_model,
      kind: 'template',
    };
  }
  return {
    is_shared,
    is_group: false,
    title,
    content_model,
    kind: 'template',
  };
}

export function content_model_for_repo_subfile(
  rel_under_root: string,
  css_content_model: string,
  opts: { allow_scribunto: boolean },
): string {
  if (opts.allow_scribunto) {
    if (rel_under_root.endsWith('.module.lua')) return 'scribunto';
    if (rel_under_root.endsWith('.module.luau')) return 'scribunto';
  } else {
    if (rel_under_root.endsWith('.module.lua') || rel_under_root.endsWith('.module.luau')) {
      throw new Error(
        `WikiWire: ${rel_under_root}: Scribunto module files (.module.lua, .module.luau) belong under modules/ only`,
      );
    }
  }

  if (rel_under_root.endsWith('.wikitext')) return 'wikitext';
  if (rel_under_root.endsWith('.css')) return css_content_model;
  if (rel_under_root.endsWith('.json')) return 'json';
  if (rel_under_root.endsWith('.js')) return 'javascript';

  throw new Error(
    `WikiWire: unsupported subfile extension: ${rel_under_root} (allowed: .module.lua, .module.luau, .wikitext, .css, .json, .js; .module.lua/.module.luau only under modules/)`,
  );
}

export function content_model_for_module_subfile(
  rel_under_root: string,
  css_content_model: string,
): string {
  return content_model_for_repo_subfile(rel_under_root, css_content_model, {
    allow_scribunto: true,
  });
}
