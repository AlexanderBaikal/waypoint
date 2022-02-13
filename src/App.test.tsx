import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { savedOnlyToggled } from "./app/uiSlice";
import { setRepositoryForTesting } from "./data";
import { NotAllowedError, type PlacesRepository } from "./data/repository";
import type { PhotoCredit, Place, Review } from "./domain/place";
import { renderWithStore } from "./test/renderWithStore";

// Leaflet needs real layout and a real canvas, neither of which jsdom provides.
// The map is covered by the Playwright suite; here it stands in as a list of
// buttons so map-to-panel selection is still exercised.
jest.mock("./features/map/MapView", () => ({
  MapView: ({
    places,
    onSelect,
  }: {
    places: Place[];
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="map">
      {places.map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => {
            onSelect(place.id);
          }}
        >
          {`marker: ${place.name}`}
        </button>
      ))}
    </div>
  ),
}));

// The form's location picker is a second Leaflet map, for the same reason.
// A place opens the form already carrying coordinates, so a readout is enough
// to prove the form is wired to them.
jest.mock("./features/places/LocationPicker", () => ({
  LocationPicker: ({ value }: { value: { lat: number; lng: number } }) => (
    <div data-testid="location-picker">{`${String(value.lat)},${String(value.lng)}`}</div>
  ),
}));

function place(id: string, name: string, type: string): Place {
  return {
    id,
    name,
    type,
    coords: { lat: 52.28, lng: 104.29 },
    address: `${name} street`,
    phone: null,
    website: null,
    about: null,
    cover: null,
    coverCredit: null,
    photos: [],
    rating: null,
    schedule: null,
    authorId: null,
  };
}

const places = [
  place("subway", "Subway", "Fast food"),
  place("sberbank", "Sberbank", "Bank"),
  place("kinomoll", "Kinomoll", "Movie theater"),
];

const reviews: Review[] = [
  {
    id: "r1",
    placeId: "subway",
    author: { name: "Alex", photoUrl: null },
    rating: 4,
    text: "Reliable enough",
    date: "2026-01-05T10:00:00.000Z",
    photos: [],
  },
];

/** Writes reject unless a test opts in, so an unexpected one is a failure. */
const unexpected = () => Promise.reject(new Error("not expected to write"));

function stubRepository(overrides: Partial<PlacesRepository> = {}): PlacesRepository {
  return {
    source: "fixtures",
    writable: true,
    listPlaces: () => Promise.resolve(places),
    listReviews: (placeId) =>
      Promise.resolve(reviews.filter((review) => review.placeId === placeId)),
    createPlace: unexpected,
    updatePlace: unexpected,
    addReview: unexpected,
    ...overrides,
  };
}

beforeEach(() => {
  setRepositoryForTesting(stubRepository());
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  setRepositoryForTesting(null);
});

const list = () => screen.getByRole("list");

/** The panel opens on its invitation, so that is what "loaded" looks like. */
const loaded = () => screen.findByText(/3 places on the map/);

describe("App", () => {
  it("waits to be asked before it lists anything", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    // Every place is already on the map; the list is what a question produces.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: /search places/i }), "sub");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("filters the list and the map together as you type", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    await user.type(screen.getByRole("searchbox", { name: /search places/i }), "sub");

    expect(await screen.findByText("1 place")).toBeInTheDocument();
    expect(within(list()).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "marker: Subway" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "marker: Sberbank" }),
    ).not.toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    // Scoped to the chips: list rows also carry their category in the label.
    const filters = screen.getByRole("group", { name: /filter places/i });
    await user.click(within(filters).getByRole("button", { name: /services/i }));

    expect(await screen.findByText("1 place")).toBeInTheDocument();
    expect(within(list()).getByText("Sberbank")).toBeInTheDocument();
  });

  it("offers a way out when nothing matches", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    await user.type(screen.getByRole("searchbox", { name: /search places/i }), "zzzz");
    expect(await screen.findByText(/nothing here matches/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(await loaded()).toBeInTheDocument();
  });

  it("opens the detail panel from a marker and comes back", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    await user.click(screen.getByRole("button", { name: "marker: Subway" }));

    expect(await screen.findByRole("heading", { name: "Subway" })).toBeInTheDocument();
    expect(await screen.findByText("Reliable enough")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /all places/i }));
    expect(await loaded()).toBeInTheDocument();
  });

  it("puts the selected place in the URL so it can be linked", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    await user.click(screen.getByRole("button", { name: "marker: Kinomoll" }));

    await waitFor(() => {
      expect(window.location.search).toBe("?place=kinomoll");
    });
  });

  it("keeps a saved place in the store and in localStorage", async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />);
    await loaded();

    await user.click(screen.getByRole("button", { name: "marker: Subway" }));
    await user.click(await screen.findByRole("button", { name: /save/i }));

    expect(store.getState().saved.ids).toEqual(["subway"]);
    expect(window.localStorage.getItem("waypoint:saved")).toBe('["subway"]');
  });

  /**
   * The saved list has no screen of its own; it is a chip in the filter row.
   * The chip has to arrive with the first bookmark, since before that it could
   * only ever produce an empty list.
   */
  it("offers the saved chip once something is saved, and filters to it", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    const chips = () => screen.getByRole("group", { name: /filter places/i });
    expect(within(chips()).queryByRole("button", { name: "Saved" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "marker: Subway" }));
    await user.click(await screen.findByRole("button", { name: /save/i }));
    await user.click(screen.getByRole("button", { name: /all places/i }));

    await user.click(await within(chips()).findByRole("button", { name: "Saved" }));

    expect(await screen.findByText("1 place")).toBeInTheDocument();
    expect(within(list()).getByText("Subway")).toBeInTheDocument();
    expect(within(list()).queryByText("Sberbank")).toBeNull();
    // The map narrows with the list rather than staying on all three.
    expect(screen.queryByRole("button", { name: "marker: Sberbank" })).toBeNull();
  });

  it("says what an empty saved list means rather than blaming the filter", async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />);
    await loaded();

    store.dispatch(savedOnlyToggled());

    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(await loaded()).toBeInTheDocument();
  });

  it("shows the failure and allows a retry when loading breaks", async () => {
    setRepositoryForTesting(
      stubRepository({
        listPlaces: () => Promise.reject(new Error("Firestore is unreachable")),
      }),
    );

    renderWithStore(<App />);

    expect(await screen.findByText("Firestore is unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

/**
 * The write path, exercised through the panel rather than against the
 * components in isolation. What is worth pinning down is that a filled form
 * reaches the repository with the right arguments, and that a refused write
 * leaves nothing behind.
 */
describe("App: writing", () => {
  const openPlace = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("button", { name: `marker: ${name}` }));
    return screen.findByRole("heading", { name });
  };

  it("adds a place and opens it", async () => {
    const user = userEvent.setup();
    const createPlace = jest.fn((input: { name: string }) =>
      Promise.resolve({ ...place("new-cafe", input.name, "Cafe"), authorId: "local" }),
    );
    setRepositoryForTesting(stubRepository({ createPlace }));

    renderWithStore(<App />);
    await loaded();

    await user.click(screen.getByRole("button", { name: /^\+ Add$/ }));
    await user.type(screen.getByLabelText(/^name$/i), "New Cafe");
    await user.type(screen.getByLabelText(/^type$/i), "Cafe");
    await user.click(screen.getByRole("button", { name: /add place/i }));

    expect(createPlace).toHaveBeenCalledOnce();
    expect(createPlace.mock.calls[0]?.[0]).toMatchObject({
      name: "New Cafe",
      type: "Cafe",
    });
    // The panel lands on what was just added rather than back in the list.
    expect(await screen.findByRole("heading", { name: "New Cafe" })).toBeInTheDocument();
  });

  it("suggests a type by the category it belongs to", async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    await loaded();

    await user.click(screen.getByRole("button", { name: /^\+ Add$/ }));

    // Nothing about the word "Bank" says it is a service. The category is what
    // connects the two, and being able to search it is the reason this list is
    // ours rather than the browser's.
    const type = screen.getByLabelText(/^type$/i);
    await user.type(type, "services");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Bank");

    // Enter takes the highlighted suggestion. The form it sits in must not
    // read that as a submission.
    await user.keyboard("{Enter}");
    expect(type).toHaveValue("Bank");
    expect(screen.getByRole("heading", { name: /add a place/i })).toBeInTheDocument();
  });

  it("will not submit a place with nothing in it", async () => {
    const user = userEvent.setup();
    const createPlace = jest.fn();
    setRepositoryForTesting(stubRepository({ createPlace }));

    renderWithStore(<App />);
    await loaded();

    await user.click(screen.getByRole("button", { name: /^\+ Add$/ }));
    await user.click(screen.getByRole("button", { name: /add place/i }));

    expect(await screen.findByText(/a place needs a name/i)).toBeInTheDocument();
    expect(createPlace).not.toHaveBeenCalled();
  });

  it("edits a place that has no owner", async () => {
    const user = userEvent.setup();
    const updatePlace = jest.fn((id: string, input: { name: string }) =>
      Promise.resolve(place(id, input.name, "Fast food")),
    );
    setRepositoryForTesting(stubRepository({ updatePlace }));

    renderWithStore(<App />);
    await loaded();
    await openPlace(user, "Subway");

    // Imported places carry no author, which is what makes them community-editable.
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const name = screen.getByLabelText(/^name$/i);
    await user.clear(name);
    await user.type(name, "Subway on Lenin");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updatePlace).toHaveBeenCalledOnce();
    expect(updatePlace.mock.calls[0]?.[1]).toMatchObject({ name: "Subway on Lenin" });
  });

  it("does not offer to edit someone else's place", async () => {
    const user = userEvent.setup();
    setRepositoryForTesting(
      stubRepository({
        listPlaces: () =>
          Promise.resolve([
            { ...place("theirs", "Theirs", "Cafe"), authorId: "someone" },
          ]),
      }),
    );

    renderWithStore(<App />);
    await user.click(await screen.findByRole("button", { name: "marker: Theirs" }));
    await screen.findByRole("heading", { name: "Theirs" });

    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    // Reviewing is still open to everyone.
    expect(screen.getByRole("button", { name: /write a review/i })).toBeInTheDocument();
  });

  it("posts a review and shows it without refetching", async () => {
    const user = userEvent.setup();
    const addReview = jest.fn((placeId: string, input: { rating: number; text: string }) =>
      Promise.resolve({
        id: "new",
        placeId,
        author: { name: "You", photoUrl: null },
        rating: input.rating,
        text: input.text,
        date: "2024-01-07T12:00:00.000Z",
        photos: [],
      }),
    );
    setRepositoryForTesting(stubRepository({ addReview }));

    renderWithStore(<App />);
    await loaded();
    await openPlace(user, "Kinomoll");

    await user.click(screen.getByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("radio", { name: /4 stars/i }));
    await user.type(screen.getByLabelText(/what was it like/i), "Good seats");
    await user.click(screen.getByRole("button", { name: /post review/i }));

    expect(addReview).toHaveBeenCalledOnce();
    expect(addReview.mock.calls[0]?.[1]).toMatchObject({ rating: 4, text: "Good seats" });
    expect(await screen.findByText("Good seats")).toBeInTheDocument();
  });

  it("takes back an optimistic review when the write is refused", async () => {
    const user = userEvent.setup();
    setRepositoryForTesting(
      stubRepository({
        addReview: () => Promise.reject(new NotAllowedError()),
      }),
    );

    renderWithStore(<App />);
    await loaded();
    await openPlace(user, "Kinomoll");

    await user.click(screen.getByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("radio", { name: /5 stars/i }));
    await user.type(screen.getByLabelText(/what was it like/i), "Briefly here");
    await user.click(screen.getByRole("button", { name: /post review/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/permission/i);

    // The form stays open so the attempt is not thrown away. Leaving it should
    // reveal a reviews list with no trace of the optimistic entry: the rules
    // are the authority, and the screen has to agree with them.
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await screen.findByRole("heading", { name: /reviews/i });
    expect(screen.queryByText("Briefly here")).not.toBeInTheDocument();
  });

  /**
   * Almost every photograph on this map was borrowed from Wikimedia Commons,
   * and most of them are of the street the place is on rather than of the
   * place. Both facts are the panel's to state: the distance because the
   * reader is owed it, the author and licence because the licence requires it.
   */
  describe("a borrowed photograph", () => {
    const credit = {
      source: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:House.jpg",
      author: "Ann",
      licence: "CC BY-SA 4.0",
      nearbyMetres: 41,
      generic: false,
    };

    const open = async (
      user: ReturnType<typeof userEvent.setup>,
      coverCredit: PhotoCredit,
    ) => {
      const photographed = places.map((place, index) =>
        index === 0
          ? { ...place, cover: "https://example.test/house.jpg", coverCredit }
          : place,
      );
      setRepositoryForTesting(
        stubRepository({ listPlaces: () => Promise.resolve(photographed) }),
      );

      const view = renderWithStore(<App />);
      await loaded();
      await user.click(screen.getByRole("button", { name: "marker: Subway" }));
      await screen.findByRole("heading", { name: "Subway" });
      return view;
    };

    it("says how far away a photograph of the surroundings was taken", async () => {
      await open(userEvent.setup(), credit);

      expect(screen.getByText(/41 m away/)).toBeInTheDocument();
      expect(screen.getByText(/Ann, CC BY-SA 4.0/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Wikimedia Commons" })).toHaveAttribute(
        "href",
        credit.sourceUrl,
      );
    });

    it("claims no distance for a photograph of the place itself", async () => {
      await open(userEvent.setup(), { ...credit, nearbyMetres: null });

      expect(screen.queryByText(/away/)).not.toBeInTheDocument();
      expect(screen.getByText(/Ann, CC BY-SA 4.0/)).toBeInTheDocument();
    });

    it("says a stock photograph is not of this place", async () => {
      await open(userEvent.setup(), { ...credit, nearbyMetres: null, generic: true });

      expect(screen.queryByText(/away/)).not.toBeInTheDocument();
      expect(screen.getByText(/Generic photo, not of this place/)).toBeInTheDocument();
    });

    it("takes the credit down with a photograph that fails to load", async () => {
      const { container } = await open(userEvent.setup(), credit);

      // Queried through the DOM because the cover is decorative and carries no
      // accessible name, being the place's picture rather than information.
      const cover = container.querySelector("figure img");
      expect(cover).not.toBeNull();
      fireEvent.error(cover as HTMLImageElement);

      // A line of attribution standing under the coloured placeholder would be
      // crediting a photograph nobody can see.
      await waitFor(() => {
        expect(screen.queryByText(/41 m away/)).not.toBeInTheDocument();
      });
      expect(screen.queryByRole("link", { name: "Wikimedia Commons" })).toBeNull();
    });
  });
});
