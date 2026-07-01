import { HiX } from "react-icons/hi";

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>
            <HiX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
