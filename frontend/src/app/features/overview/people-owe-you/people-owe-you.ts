import { Component, computed, inject, input } from '@angular/core';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Entry } from '../../../core/models';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { personRow } from '../../../shared/utils/person-row';
import { toggleEntry } from '../../../shared/utils/entry-actions';

/** Short "People owe you" list with "Mark received". */
@Component({
  selector: 'app-people-owe-you',
  imports: [InrPipe],
  templateUrl: './people-owe-you.html',
  styleUrl: './people-owe-you.scss',
})
export class PeopleOweYou {
  private store = inject(AppStore);
  private api = inject(Api);
  readonly rows = input.required<Entry[]>();
  readonly pending = input.required<number>();
  protected readonly view = computed(() => this.rows().map(personRow));

  toggle(r: Entry) { toggleEntry(this.api, this.store, r); }
}
