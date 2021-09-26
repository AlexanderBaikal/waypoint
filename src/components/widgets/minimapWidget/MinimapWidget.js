import LayersRoundedIcon from "@material-ui/icons/LayersRounded";
import { makeStyles } from "@material-ui/core";
import clsx from "clsx";

const useStyles = makeStyles((theme) => {
  return {
    minimap: {
      backgroundColor: "#ccc",
      borderRadius: "8px",
      border: "2px solid white",
      boxShadow: "0px 1px 4px rgb(0 0 0 / 30%)",
      height: "75px",
      opacity: 1,
      transform: "translateZ(0)",
      transition:
        "width 0.4s, height 0.4s, opacity 0.6s ease-in, margin-bottom 0.4s",
      width: "75px",
      marginBottom: "20px",
      cursor: "pointer",
    },
    minimapLarge: {
      width: "110px",
      height: "110px",
      border: "none",
    },
    minimapImage: {
      height: "inherit",
      borderRadius: "6px",
    },
    minimapLabel: {
      borderRadius: "6px",
      cursor: "pointer",
      color: "white",
      fontSize: "12px",
      position: "absolute",
      lineHeight: "normal",
      padding: "12px 0 3px 8px",
      bottom: 0,
      left: 0,
      width: "calc(100% - 8px)",
      backgroundImage:
        "-webkit-linear-gradient(transparent, rgba(0, 0, 0, 0.6))",
    },

    labelText: {
      display: "inline-block",
      hyphens: "auto",
      verticalAlign: "super",
      marginLeft: "4px",
    },
  };
});

const MinimapWidget = ({ bottomGallery }) => {
  const classes = useStyles();

  const imgTempUrl =
    "https://www.google.ru/maps/vt/pb=!1m5!1m4!1i10!2i1613!3i679!4i128!2m2!1e1!3i904!3m9!2sru!3sru!5e1105!12m1!1e4!12m1!1e47!12m1!1e3!4e0!5m2!1e0!5f2!23i10203575!23i1381938!23i1371340!23i1381033!23i1368782!23i1368785!23i1385853!23i46990830!23i1375050!23i4536287";
  return (
    <div
      className={
        bottomGallery
          ? clsx(classes.minimapLarge, classes.minimap)
          : classes.minimap
      }
    >
      <img className={classes.minimapImage} src={imgTempUrl} alt="" />
      <div className={classes.minimapLabel}>
        <LayersRoundedIcon fontSize="small" />
        <label className={classes.labelText}>Layers</label>
      </div>
    </div>
  );
};

export default MinimapWidget;
