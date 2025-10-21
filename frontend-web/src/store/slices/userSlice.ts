import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState, UserState } from '../../types';

const initialState: UserState = {
  postalCode: '',
  lastLocation: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setPostalCode: (state, action: PayloadAction<string>) => {
      state.postalCode = action.payload;
    },
    setLastLocation: (
      state,
      action: PayloadAction<{ latitude: number; longitude: number }>
    ) => {
      state.lastLocation = action.payload;
    },
  },
});

export const { setPostalCode, setLastLocation } = userSlice.actions;

// Selectors
export const selectPostalCode = (state: RootState) => state.user.postalCode;
export const selectLastLocation = (state: RootState) => state.user.lastLocation;

export default userSlice.reducer;
