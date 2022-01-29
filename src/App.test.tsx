import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { setRepositoryForTesting } from "./data";
import type { PlacesRepository } from "./data/repository";
import type { Place, Review } from "./domain/place";
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
    const filters = screen.getByRole("group", { name: /filter by category/i });
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
