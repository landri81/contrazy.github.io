import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

type PricingMode = "monthly" | "yearly"

type UiState = {
  mobileMenuOpen: boolean
  pricingMode: PricingMode
}

const initialState: UiState = {
  mobileMenuOpen: false,
  pricingMode: "monthly",
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setMobileMenuOpen(state, action: PayloadAction<boolean>) {
      state.mobileMenuOpen = action.payload
    },
    toggleMobileMenu(state) {
      state.mobileMenuOpen = !state.mobileMenuOpen
    },
    setPricingMode(state, action: PayloadAction<PricingMode>) {
      state.pricingMode = action.payload
    },
  },
})

export const { setMobileMenuOpen, toggleMobileMenu, setPricingMode } = uiSlice.actions
export const uiReducer = uiSlice.reducer
