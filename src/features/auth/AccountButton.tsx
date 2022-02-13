import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { authAvailable } from "./authService";
import { signIn, signOutUser } from "./authSlice";
import styles from "./auth.module.css";

/**
 * Hidden entirely when Firebase is not configured, rather than offering a
 * sign-in button that cannot work.
 */
export function AccountButton() {
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((state) => state.auth);

  if (!authAvailable) return null;

  if (user) {
    return (
      <div className={styles.account}>
        {user.photoUrl ? (
          <img
            className={styles.avatar}
            src={user.photoUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : null}
        <button
          type="button"
          className={styles.link}
          onClick={() => void dispatch(signOutUser())}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={styles.account}>
      <button
        type="button"
        className={styles.link}
        disabled={status === "pending"}
        onClick={() => void dispatch(signIn())}
      >
        {status === "pending" ? "Signing in…" : "Sign in"}
      </button>
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}
