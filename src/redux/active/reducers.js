import {
  SET_CATEGORY_MODAL,
  SET_ADD_PHOTO,
  SET_HOURS_MODAL,
  SET_SCHEDULE_MODAL,
  SET_ADD_COMMENT,
  SET_OPEN_COMPLETE_EDIT_INFO,
  SET_OPEN_COMPLETE_PHOTO,
  SET_OPEN_EDIT,
  SET_OPEN_EDIT_INFO,
  SET_OPEN_UPLOAD_PHOTO,
  MAIN_UNDERSEARCH_BAR,
  SET_ACTIVE_BAR,
  SET_SEARCH_PROMPT,
  SET_UNDERSEARCH_BAR,
  SET_BOTTOM_GALLERY,
  SET_MENU_SIDEBAR,
  SET_LOCATION_MODAL,
  SET_PHOTO_GALLERY,
  SET_SHOWN_MORE,
  SET_INFO_MODAL
} from "./actions";

const defaultState = {
  categoryModal: false,
  addPhoto: false,
  hoursModal: false,
  scheduleModal: false,
  locationModal: false,
  infoModal: false,
  addComment: false,
  openEdit: false,
  openEditInfo: false,
  openCompleteEditInfo: false,
  openUploadPhoto: false,
  openCompletePhoto: false,
  activeBar: MAIN_UNDERSEARCH_BAR,
  searchPrompt: false,
  underSearchBar: false,
  bottomGallery: false,
  menuSidebar: false,
  photoGallery: false,
  shownMore: false,
};

export const activeReducer = (state = defaultState, action) => {
  switch (action.type) {
    case SET_ADD_PHOTO:
      return {
        ...state,
        addPhoto: action.payload,
      };
    case SET_CATEGORY_MODAL:
      return {
        ...state,
        categoryModal: action.payload,
      };
    case SET_LOCATION_MODAL:
      return {
        ...state,
        locationModal: action.payload,
      };
    case SET_INFO_MODAL:
      return {
        ...state,
        infoModal: action.payload,
      };
    case SET_HOURS_MODAL:
      return {
        ...state,
        hoursModal: action.payload,
      };
    case SET_SCHEDULE_MODAL:
      return {
        ...state,
        scheduleModal: action.payload,
      };
    case SET_ADD_COMMENT:
      return {
        ...state,
        addComment: action.payload,
      };
    case SET_OPEN_EDIT:
      return {
        ...state,
        openEdit: action.payload,
      };
    case SET_OPEN_EDIT_INFO:
      return {
        ...state,
        openEditInfo: action.payload,
      };
    case SET_OPEN_COMPLETE_EDIT_INFO:
      return {
        ...state,
        openCompleteEditInfo: action.payload,
      };
    case SET_OPEN_UPLOAD_PHOTO:
      return {
        ...state,
        openUploadPhoto: action.payload,
      };
    case SET_OPEN_COMPLETE_PHOTO:
      return {
        ...state,
        openCompletePhoto: action.payload,
      };
    case SET_ACTIVE_BAR:
      return {
        ...state,
        activeBar: action.payload,
      };
    case SET_SEARCH_PROMPT:
      return {
        ...state,
        searchPrompt: !state.searchPrompt,
      };
    case SET_UNDERSEARCH_BAR:
      return {
        ...state,
        underSearchBar: action.payload,
      };

    case SET_BOTTOM_GALLERY:
      return {
        ...state,
        bottomGallery: action.payload,
      };
    case SET_MENU_SIDEBAR:
      return {
        ...state,
        menuSidebar: action.payload,
      };
    case SET_PHOTO_GALLERY:
      return {
        ...state,
        photoGallery: action.payload,
      };
    case SET_SHOWN_MORE:
      return {
        ...state,
        shownMore: action.payload,
      };
  }
  return state;
};

export default activeReducer;
