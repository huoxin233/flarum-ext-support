import type IGambit from 'flarum/common/query/IGambit';
import { BooleanGambit, KeyValueGambit, GambitType, type GroupedGambitSuggestion } from 'flarum/common/query/IGambit';
import { canHandleSupportTickets } from '../utils/permissions';

export const SUPPORT_TICKETS_RESOURCE = 'linkrobins-support-tickets';

/**
 * Filter support tickets by status: is:open, is:in_progress, is:awaiting_user, is:resolved, is:closed.
 * Supports negation (e.g. -is:closed).
 */
export class StatusGambit implements IGambit<GambitType.Grouped> {
  type = GambitType.Grouped;
  predicates = false;

  key(): string[] {
    return ['open', 'in_progress', 'awaiting_user', 'resolved', 'closed'];
  }

  filterKey(): string {
    return 'status';
  }

  booleanKey(): 'is' | 'has' | 'allows' {
    return 'is';
  }

  groupKey(): string {
    return (app.translator && app.translator.trans('core.lib.gambits.group_keys.' + this.booleanKey(), {}, true)) || 'is';
  }

  pattern(): string {
    const is = this.groupKey();
    return `${is}:(${this.key().join('|')})`;
  }

  toFilter(matches: string[], negate: boolean): Record<string, any> {
    const key = (negate ? '-' : '') + this.filterKey();
    return {
      [key]: matches[1],
    };
  }

  fromFilter(value: any, negate: boolean): string {
    const is = this.groupKey();
    if (Array.isArray(value)) {
      return value.map((v) => `${negate ? '-' : ''}${is}:${v}`).join(' ');
    }
    return `${negate ? '-' : ''}${is}:${value}`;
  }

  suggestion(): GroupedGambitSuggestion {
    return {
      group: this.groupKey(),
      key: this.key(),
    };
  }

  enabled(): boolean {
    return true;
  }
}

/**
 * Filter tickets by claim status: is:assigned, is:unassigned (staff only).
 */
export class AssignedGroupedGambit implements IGambit<GambitType.Grouped> {
  type = GambitType.Grouped;
  predicates = false;

  key(): string[] {
    return ['assigned', 'unassigned'];
  }

  filterKey(): string {
    return 'assigned';
  }

  booleanKey(): 'is' | 'has' | 'allows' {
    return 'is';
  }

  groupKey(): string {
    return (app.translator && app.translator.trans('core.lib.gambits.group_keys.' + this.booleanKey(), {}, true)) || 'is';
  }

  pattern(): string {
    const is = this.groupKey();
    return `${is}:(assigned|unassigned)`;
  }

  toFilter(matches: string[], negate: boolean): Record<string, any> {
    const key = (negate ? '-' : '') + this.filterKey();
    const val = matches[1] === 'unassigned' ? 'none' : 'assigned';
    return {
      [key]: val,
    };
  }

  fromFilter(value: any, negate: boolean): string {
    const is = this.groupKey();
    if (value === 'none' || value === 'unassigned') {
      return `${negate ? '-' : ''}${is}:unassigned`;
    }
    if (value === 'assigned') {
      return `${negate ? '-' : ''}${is}:assigned`;
    }
    return '';
  }

  suggestion(): GroupedGambitSuggestion {
    return {
      group: this.groupKey(),
      key: this.key(),
    };
  }

  enabled(): boolean {
    return canHandleSupportTickets();
  }
}

/**
 * Key-value assignee filter: assigned:me or assigned:none (staff only).
 */
export class AssignedGambit extends KeyValueGambit {
  key(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.assigned.key', {}, true)) || 'assigned';
  }

  hint(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.assigned.hint', {}, true)) || 'me or none';
  }

  filterKey(): string {
    return 'assigned';
  }

  pattern(): string {
    return `${this.key()}:(me|none)`;
  }

  toFilter(matches: string[], negate: boolean): Record<string, any> {
    const key = (negate ? '-' : '') + this.filterKey();
    return {
      [key]: matches[1],
    };
  }

  fromFilter(value: any, negate: boolean): string {
    if (value === 'me') {
      return `${negate ? '-' : ''}${this.key()}:me`;
    }
    return '';
  }

  enabled(): boolean {
    return canHandleSupportTickets();
  }
}

/**
 * Staff-only filter for own filed tickets: is:mine.
 */
export class MineGambit extends BooleanGambit {
  key(): string {
    return 'mine';
  }

  filterKey(): string {
    return 'mine';
  }

  toFilter(_matches: string[], negate: boolean): Record<string, any> {
    const key = (negate ? '-' : '') + this.filterKey();
    return {
      [key]: '1',
    };
  }

  fromFilter(_value: any, negate: boolean): string {
    const is = this.groupKey();
    return `${negate ? '-' : ''}${is}:mine`;
  }

  enabled(): boolean {
    return canHandleSupportTickets();
  }
}

/**
 * Filter tickets by ticket type driver: type:standard, type:appeal, etc.
 */
export class TicketTypeGambit extends KeyValueGambit {
  key(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.type.key', {}, true)) || 'type';
  }

  hint(): string {
    return (
      (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.type.hint', {}, true)) || 'standard, appeal, or custom type'
    );
  }

  filterKey(): string {
    return 'ticketType';
  }
}

/**
 * Staff-only filter for tickets opened by a specific username: author:<username>.
 */
export class AuthorGambit extends KeyValueGambit {
  key(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.author.key', {}, true)) || 'author';
  }

  hint(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.author.hint', {}, true)) || 'username';
  }

  filterKey(): string {
    return 'author';
  }

  enabled(): boolean {
    return canHandleSupportTickets();
  }
}

/**
 * Staff-only filter for tickets by priority: priority:urgent, priority:normal, priority:low.
 */
export class PriorityGambit extends KeyValueGambit {
  key(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.priority.key', {}, true)) || 'priority';
  }

  hint(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.priority.hint', {}, true)) || 'urgent, normal, or low';
  }

  filterKey(): string {
    return 'priority';
  }

  pattern(): string {
    return `${this.key()}:(urgent|normal|low|Urgent|Normal|Low)`;
  }

  toFilter(matches: string[], negate: boolean): Record<string, any> {
    const key = (negate ? '-' : '') + this.filterKey();
    return {
      [key]: matches[1].toLowerCase(),
    };
  }

  fromFilter(value: any, negate: boolean): string {
    if (typeof value === 'string') {
      return `${negate ? '-' : ''}${this.key()}:${value}`;
    }
    return '';
  }

  enabled(): boolean {
    return canHandleSupportTickets();
  }
}

/**
 * Filter tickets by category slug: category:<slug> or cat:<slug>.
 */
export class CategoryGambit extends KeyValueGambit {
  key(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.category.key', {}, true)) || 'category';
  }

  hint(): string {
    return (app.translator && app.translator.trans('linkrobins-support.lib.gambits.tickets.category.hint', {}, true)) || 'slug';
  }

  filterKey(): string {
    return 'category';
  }

  pattern(): string {
    const key = this.key();
    return `(?:${key}|cat):([a-zA-Z0-9_-]+)`;
  }

  toFilter(matches: string[], negate: boolean): Record<string, any> {
    const key = (negate ? '-' : '') + this.filterKey();
    return {
      [key]: matches[1],
    };
  }

  fromFilter(value: any, negate: boolean): string {
    if (typeof value === 'string') {
      return `${negate ? '-' : ''}${this.key()}:${value}`;
    }
    return '';
  }
}

/**
 * Register support ticket gambits with Flarum's frontend GambitManager.
 * Appends without duplicate registration to preserve third-party extensibility.
 */
export function registerTicketGambits(): void {
  if (app.search && app.search.gambits) {
    app.search.gambits.gambits[SUPPORT_TICKETS_RESOURCE] ||= [];
    const registry = app.search.gambits.gambits[SUPPORT_TICKETS_RESOURCE];
    const defaultGambits = [
      StatusGambit,
      AssignedGroupedGambit,
      AssignedGambit,
      MineGambit,
      PriorityGambit,
      CategoryGambit,
      TicketTypeGambit,
      AuthorGambit,
    ];
    for (const gambit of defaultGambits) {
      if (!registry.includes(gambit)) {
        registry.push(gambit);
      }
    }
  }
}
