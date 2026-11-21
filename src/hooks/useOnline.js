import useConnection from '../services/connection.js';

/* true while the phone has a connection. It follows the browser and the
   phone's own network status, so it is right inside the Android app too. */
export default function useOnline() {
  return useConnection().online;
    }
