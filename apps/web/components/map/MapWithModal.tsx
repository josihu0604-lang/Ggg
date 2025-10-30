'use client';

import { useState } from 'react';
import InteractiveMap from './InteractiveMap';
import POIModal from './POIModal';

interface POI {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  visitCount: number;
  hasActiveCampaign: boolean;
}

export default function MapWithModal() {
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  const handlePOIClick = (poi: POI) => {
    setSelectedPOI(poi);
  };

  const handleCloseModal = () => {
    setSelectedPOI(null);
  };

  return (
    <>
      <InteractiveMap onPOIClick={handlePOIClick} />
      {selectedPOI && (
        <POIModal poi={selectedPOI} onClose={handleCloseModal} />
      )}
    </>
  );
}
