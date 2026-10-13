import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import GlobalSearch from 'flarum/forum/components/GlobalSearch';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import ItemList from 'flarum/common/utils/ItemList';
import extractText from 'flarum/common/utils/extractText';
import { tr } from './utils/translate';
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

  // Scope active search queries in header to custom ticket searches only
  override(GlobalSearchState.prototype, 'getInitialSearch', function (original) {
    if (app.current.get('routeName')?.startsWith('linkrobins-support.')) {
      const q = m.route.param('q');
      if (typeof q === 'string' && q.trim()) {
        const trimmed = q.trim();
        if (!STANDARD_QUEUES.includes(trimmed)) {
          return trimmed;
        }
      }
      return '';
    }
    return original();
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
}
