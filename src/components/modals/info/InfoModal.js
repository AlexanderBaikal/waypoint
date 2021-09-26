import {
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    makeStyles,
    Typography,
  } from "@material-ui/core";
  import EditIcon from "@material-ui/icons/Edit";
  import CloseIcon from "@material-ui/icons/Close";
  
  const useStyles = makeStyles((theme) => ({
    root: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
  
    closeButton: {
      position: "absolute",
      right: "8px",
      top: "4px",
      color: theme.palette.grey[500],
    },
    list: {
      paddingTop: 0,
      paddingBottom: "16px",
    },
    dialog: {
      width: "400px",
    },
    dialogContent: {
      padding: 0,
    },
    gutters: {
      paddingLeft: "24px",
    },
    dialogTitle: {
      display: "flex",
      alignItems: "center",
    },
  }));
  
  const EditModal = ({ infoModal, setInfoModal }) => {
    const classes = useStyles();
  
    const onClose = () => {
       setInfoModal(false);
    };
  
    return (
      <div className={classes.root}>
        <Dialog
          onClose={onClose}
          aria-labelledby="customized-dialog-title"
          open={infoModal}
          PaperProps={{ className: classes.dialog }}
        >
          <DialogTitle className={classes.dialogTitle} onClose={onClose}>
            <Typography variant="h3" component="div">
              Info
            </Typography>
            <IconButton
              aria-label="close"
              className={classes.closeButton}
              onClick={onClose}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent classes={{ root: classes.dialogContent }}>
            <List className={classes.list}>
              <Divider component="li" />
              <ListItem
                classes={{ gutters: classes.gutters }}
              >
                <ListItemText
                    classes={{ primary: classes.listItemText }}
                    primary={"About this project"}
                    secondary={"This project was created as a study project when i first started learning frontend development in August 2021. It was created from scratch based on Leaflet and it doesn't use Google Maps API"}
                    />
              </ListItem>
              <Divider component="li" />
              <ListItem 
                classes={{ gutters: classes.gutters }}
                >
                <ListItemText
                classes={{ primary: classes.listItemText }}
                primary={"See more"}
                secondary={"You can see other projects here: alexbaikalov.com"}
                />
            </ListItem>
              <Divider component="li" />
            </List>
          </DialogContent>
        </Dialog>
      </div>
    );
  };
  
  export default EditModal;
  