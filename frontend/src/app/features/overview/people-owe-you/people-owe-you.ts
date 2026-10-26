import { Component, computed, inject, input } from '@angular/core';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Entry } from '../../../core/models';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { personRow } from '../../../shared/utils/person-row';
import { entryKey, toggleEntry } from '../../../shared/utils/entry-actions';
import { Busy } from '../../../shared/directives/busy';

/** Short "People owe you" list with "Mark received". */
@Component({
  selector: 'app-people-owe-you',
  imports: [InrPipe, Busy],
  templateUrl: './people-owe-you.html',
  styleUrl: './people-owe-you.scss',
})
export class PeopleOweYou {
  protected store = inject(AppStore);
  private api = inject(Api);
  readonly rows = input.required<Entry[]>();
  readonly pending = input.required<number>();
  protected readonly view = computed(() => this.rows().map(personRow));

  protected readonly entryKey = entryKey;
  toggle(r: Entry) { toggleEntry(this.api, this.store, r); }
}
