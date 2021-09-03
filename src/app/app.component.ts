import { Component, ChangeDetectorRef } from '@angular/core';
import {
  onAuthUIStateChange,
  CognitoUserInterface,
  AuthState,
} from '@aws-amplify/ui-components';
import Amplify, { API, Storage } from 'aws-amplify';
import { listNotes } from '../graphql/queries';
import config from '../aws-exports';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from '../graphql/mutations';
Amplify.configure(config);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  user: CognitoUserInterface | undefined;
  authState: AuthState;

  formData: FormGroup;
  notes = [];

  constructor(private ref: ChangeDetectorRef, private fb: FormBuilder) {}

  ngOnInit() {
    this.setAuthState();
    this.resetFormData();
    this.fetchNotes();
  }

  setAuthState() {
    onAuthUIStateChange((authState, authData) => {
      this.authState = authState;
      this.user = authData as CognitoUserInterface;
      this.ref.detectChanges();
    });
  }

  resetFormData() {
    this.formData = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      image: [null],
    });
  }

  async uploadImage(event) {
    if (!event.target.files[0]) return;
    const file = event.target.files[0];
    this.formData.patchValue({ image: file.name });
    await Storage.put(file.name, file);
  }

  async fetchNotes() {
    const res: any = await API.graphql({ query: listNotes });
    const notes = res.data.listNotes.items;

    await Promise.all(
      notes.map(async (note) => {
        if (note.image) {
          const image = await Storage.get(note.image);
          note.image = image;
        }
        return note;
      })
    );

    this.notes = notes;
  }

  async createNote() {
    await API.graphql({
      query: createNoteMutation,
      variables: { input: this.formData.value },
    });
    if (this.formData.value.image) {
      const image = await Storage.get(this.formData.value);
      this.formData.patchValue({ image });
    }
    this.notes = [...this.notes, this.formData.value];
    this.resetFormData();
  }

  async deleteNote({ id }) {
    const newNotesArray = this.notes.filter((note) => note.id !== id);
    await API.graphql({
      query: deleteNoteMutation,
      variables: { input: { id } },
    });
    this.notes = newNotesArray;
  }

  ngOnDestroy() {
    return onAuthUIStateChange;
  }
}
