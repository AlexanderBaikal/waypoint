import { makeStyles } from "@material-ui/core";
import { useDispatch } from "react-redux";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import { setInfoModal } from "../../../redux/active/actions";

const useStyles = makeStyles((theme) => {
  return {
    apps: {
      cursor: "pointer",
      width: "24px",
      height: "24px",
      marginRight: "17px",
    },
    userWidget: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      },
  };
});

const InfoWidget = ({ }) => {
  const classes = useStyles();
  const dispatch = useDispatch()

  const showInfo = () => {
    dispatch(setInfoModal(true))
  }

  return (
    <div className={classes.userWidget}>
      <InfoOutlinedIcon
        size={28}
        className={classes.apps}
        onClick={showInfo}
      />
    </div>
  );
};

export default InfoWidget;
