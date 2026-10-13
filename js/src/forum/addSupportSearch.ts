import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import GlobalSearch from 'flarum/forum/components/GlobalSearch';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import ItemList from 'flarum/common/utils/ItemList';
import extractText from 'flarum/common/utils/extractText';
import { tr } from './utils/translate';
import { canHandleSupportTickets } from './utils/permissions';
import { SUPPORT_TICKETS_RESOURCE } from './query/ticketGambits';
import SupportTicketsSearchSource from './query/SupportTicketsSearchSource';
import type { GlobalSearchSource } from 'flarum/common/components/AbstractGlobalSearch';

const STANDARD_QUEUES = ['is:mine', 'is:open', 'assigned:me -is:closed', 'is:unassigned -is:closed', 'is:closed'];

export default function addSupportSearch() {
  // Override search sources when on any support desk route
  override(GlobalSearch.prototype, 'sourceItems', function (this: any, original) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      this.attrs.label = extractText(tr('index.search_placeholder', 'Search tickets'));
      const items = new ItemList<GlobalSearchSource>();
      items.add('tickets', new SupportTicketsSearchSource());
      return items;
    }
    this.attrs.label = app.translator.trans('core.forum.header.search_placeholder', {}, true);
    return original();
  });

  // Scope active search queries in header to the dedicated search page only
  override(GlobalSearchState.prototype, 'getInitialSearch', function (original) {
    if (app.current.get('routeName') === 'linkrobins-support.search') {
      const q = m.route.param('q');
      return (typeof q === 'string' && q.trim()) || '';
    }
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      return '';
    }
    return original();
  });

  // Automatically select support tickets source when on support routes
  override('flarum/common/components/SearchModal' as any, 'defaultActiveSource', function (original: any) {
    const orig = original();
    if (!orig && app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      return SUPPORT_TICKETS_RESOURCE;
    }
    return orig;
  });

  // Customize lazy-loaded SearchModal when invoked on support desk routes
  override('flarum/common/components/SearchModal' as any, 'title', function (original: any) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      return tr('index.search_tickets_title', 'Search tickets');
    }
    return original();
  });

  extend('flarum/common/components/SearchModal' as any, 'tabItems', function (this: any, items: ItemList<any>) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.') && this.sources?.length <= 1) {
      items.remove('tickets');
      items.remove('linkrobins-support-tickets');
    }
  });

  extend('flarum/common/components/SearchModal' as any, 'selectResult', function () {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      app.modal.close();
    }
  });

  // Populate default filters for support tickets on modal initialization
  extend('flarum/common/components/SearchModal' as any, 'defaultFilters', function (this: any, filters: any) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      filters[SUPPORT_TICKETS_RESOURCE] ||= {};
      const routeName = app.current.get('routeName');
      if (routeName === 'linkrobins-support.show') {
        const ticketId = m.route.param('id');
        const ticket = app.current.get('ticket') || (ticketId ? app.store.getById('linkrobins-support-tickets', ticketId) : null);
        const cat = ticket && typeof ticket.category === 'function' ? ticket.category() : null;
        const slug = cat && typeof cat.slug === 'function' ? cat.slug() : null;
        if (slug) {
          filters[SUPPORT_TICKETS_RESOURCE].category = slug;
        }
      }
    }
  });

  // Pre-fill gambits according to the active support desk view/page
  override('flarum/common/components/SearchModal' as any, 'prefill', function (this: any, original: any, value: string) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      const routeName = app.current.get('routeName');

      if (routeName === 'linkrobins-support.search') {
        const qParam = m.route.param('q');
        return (typeof qParam === 'string' && qParam.trim()) || value || '';
      }

      const trimmed = value && value.trim();
      if (trimmed && !STANDARD_QUEUES.includes(trimmed)) {
        return trimmed;
      }

      if (routeName === 'linkrobins-support.index') {
        const currentQueue = (m.route.param('q') || app.current.get('query') || '').trim();
        if (currentQueue) {
          return currentQueue;
        }

        if (canHandleSupportTickets()) {
          const pref = app.session?.user?.preferences()?.linkrobinsSupportStaffDefaultView;
          return typeof pref === 'string' && pref.trim() ? pref.trim() : 'is:open';
        }
        return 'is:mine';
      }

      if (routeName === 'linkrobins-support.show') {
        const ticketId = m.route.param('id');
        const ticket = app.current.get('ticket') || (ticketId ? app.store.getById('linkrobins-support-tickets', ticketId) : null);
        const cat = ticket && typeof ticket.category === 'function' ? ticket.category() : null;
        const slug = cat && typeof cat.slug === 'function' ? cat.slug() : null;
        if (slug) {
          return `category:${slug}`;
        }
      }

      if (routeName === 'linkrobins-support.compose') {
        const catParam = m.route.param('category') || app.current.get('category');
        if (typeof catParam === 'string' && catParam.trim()) {
          return `category:${catParam.trim()}`;
        }
      }
    }

    return original(value);
  });

  // Track initial query on modal initialization to detect user modifications
  extend('flarum/common/components/SearchModal' as any, 'oninit', function (this: any) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      this._supportInitialQuery = this.query && this.query();
    }
  });

  // Prepare input with trailing space, end cursor position, and trigger search on mount
  extend('flarum/common/components/SearchModal' as any, 'oncreate', function (this: any) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      const q = this.query && this.query();
      if (q && q.trim()) {
        const val = q.endsWith(' ') ? q : q.trim() + ' ';
        this.query(val);
        const input = this.inputElement && this.inputElement()[0];
        if (input) {
          input.value = val;
          try {
            input.focus();
            input.setSelectionRange(val.length, val.length);
          } catch (e) {}
        }
        this.search(val.trim());
      }
    }
  });

  // Reset header search state when dismissed on non-search pages
  extend('flarum/common/components/SearchModal' as any, 'onremove', function (this: any) {
    const routeName = app.current.get('routeName');
    if (routeName?.startsWith('linkrobins-support.') && routeName !== 'linkrobins-support.search') {
      const q = this.query && this.query();
      if (!q?.trim() || q.trim() === this._supportInitialQuery?.trim()) {
        app.search.state.setValue('');
      }
    }
  });
}
