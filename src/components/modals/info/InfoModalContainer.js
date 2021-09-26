import { connect } from "react-redux";
import {
  setInfoModal,
} from "../../../redux/active/actions";
import InfoModal from "./InfoModal";

const InfoModalContainer = (props) => {
  return (
    <InfoModal
    infoModal={props.infoModal}
      setInfoModal={props.setInfoModal}
    />
  );
};

const mapStateToProps = (state) => {
  return {
    infoModal: state.active.infoModal,
  };
};

const mapDispatchToProps = {
    setInfoModal
};

export default connect(mapStateToProps, mapDispatchToProps)(InfoModalContainer);
