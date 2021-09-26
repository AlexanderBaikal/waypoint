export const SET_CATEGORY_MODAL = "SET_CATEGORY_MODAL";

export const setCategoryModal = (data) => {
  return {
    type: SET_CATEGORY_MODAL,
    payload: data,
  };
};

export const SET_ADD_PHOTO = "SET_ADD_PHOTO";

export const setAddPhoto = (data) => {
  return {
    type: SET_ADD_PHOTO,
    payload: data,
  };
};

export const SET_LOCATION_MODAL = "SET_LOCATION_MODAL";

export const setLocationModal = (data) => {
  return {
    type: SET_LOCATION_MODAL,
    payload: data,
  };
};

export const SET_INFO_MODAL = "SET_INFO_MODAL";

export const setInfoModal = (data) => {
  return {
    type: SET_INFO_MODAL,
    payload: data,
  };
};

export const SET_HOURS_MODAL = "SET_HOURS_MODAL";

export const setHoursModal = (data) => {
  return {
    type: SET_HOURS_MODAL,
    payload: data,
  };
};

export const SET_SCHEDULE_MODAL = "SET_SCHEDULE_MODAL";

export const setScheduleModal = (data) => {
  return {
    type: SET_SCHEDULE_MODAL,
    payload: data,
  };
};

export const SET_ADD_COMMENT = "SET_ADD_COMMENT";

export const setAddComment = (data) => {
  return {
    type: SET_ADD_COMMENT,
    payload: data,
  };
};

export const SET_OPEN_EDIT = "SET_OPEN_EDIT";

export const setOpenEdit = (data) => {
  return {
    type: SET_OPEN_EDIT,
    payload: data,
  };
};

export const SET_OPEN_EDIT_INFO = "SET_OPEN_EDIT_INFO";

export const setOpenEditInfo = (data) => {
  return {
    type: SET_OPEN_EDIT_INFO,
    payload: data,
  };
};

export const SET_OPEN_COMPLETE_EDIT_INFO = "SET_OPEN_COMPLETE_EDIT_INFO";

export const setOpenCompleteEditInfo = (data) => {
  return {
    type: SET_OPEN_COMPLETE_EDIT_INFO,
    payload: data,
  };
};

export const SET_OPEN_UPLOAD_PHOTO = "SET_OPEN_UPLOAD_PHOTO";

export const setOpenUploadPhoto = (data) => {
  return {
    type: SET_OPEN_UPLOAD_PHOTO,
    payload: data,
  };
};

export const SET_OPEN_COMPLETE_PHOTO = "SET_OPEN_COMPLETE_PHOTO";

export const setOpenCompletePhoto = (data) => {
  return {
    type: SET_OPEN_COMPLETE_PHOTO,
    payload: data,
  };
};

export const SET_ACTIVE_BAR = "SET_ACTIVE_BAR";
export const PLACES_BAR = "PLACES_BAR";
export const DESCRIPTION_BAR = "DESCRIPTION_BAR";
export const MAIN_UNDERSEARCH_BAR = "MAIN_UNDERSEARCH_BAR";

export const setActiveBar = (activeBar) => {
  return {
    type: SET_ACTIVE_BAR,
    payload: activeBar,
  };
};

export const SET_SEARCH_PROMPT = "SET_SEARCH_PROMPT";

export const setSearchPrompt = (searchPrompt) => ({
  type: SET_SEARCH_PROMPT,
  payload: searchPrompt,
});

export const SET_UNDERSEARCH_BAR = "SET_UNDERSEARCH_BAR";

export const setBottomGallery = (bottomGallery) => ({
  type: SET_BOTTOM_GALLERY,
  payload: bottomGallery,
});

export const SET_BOTTOM_GALLERY = "SET_BOTTOM_GALLERY";

export const setUnderSearchBar = (underSearchBar) => ({
  type: SET_UNDERSEARCH_BAR,
  payload: underSearchBar,
});

export const SET_MENU_SIDEBAR = "SET_MENU_SIDEBAR";

export const setMenuSidebar = (menuSidebar) => ({
  type: SET_MENU_SIDEBAR,
  payload: menuSidebar,
});

export const SET_PHOTO_GALLERY = "SET_PHOTO_GALLERY";

export const setPhotoGallery = (data) => ({
  type: SET_PHOTO_GALLERY,
  payload: data,
});

export const SET_SHOWN_MORE = "SET_SHOWN_MORE";

export const setShownMore = (data) => ({
  type: SET_SHOWN_MORE,
  payload: data,
});