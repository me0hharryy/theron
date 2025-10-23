import React from 'react';
import PropTypes from 'prop-types';

// Helper to format date
const formatDate = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('en-GB'); // DD/MM/YYYY
    }
    return 'N/A';
};

const MeasurementsPrint = React.forwardRef(({ order }, ref) => {
  if (!order) return null;

  // Filter out items that actually have measurements entered
  const peopleWithMeasurements = order.people?.map(person => ({
    ...person,
    items: person.items?.filter(item =>
      item.measurements && Object.values(item.measurements).some(val => val && val.trim() !== '')
    )
  })).filter(person => person.items && person.items.length > 0);

  if (!peopleWithMeasurements || peopleWithMeasurements.length === 0) {
    return (
       <div ref={ref} className="p-8 font-sans text-sm text-center">
         No measurements recorded for this order.
       </div>
    );
  }

  return (
    <div ref={ref} className="p-8 font-sans text-sm">
      <h1 className="text-xl font-bold text-center mb-4">Measurements Sheet</h1>
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div>
              <p><strong>Customer:</strong> {order.customer?.name || 'N/A'}</p>
              <p><strong>Contact:</strong> {order.customer?.number || 'N/A'}</p>
          </div>
          <div className="text-right">
              <p><strong>Order ID:</strong> {order.billNumber || 'N/A'}</p>
              <p><strong>Delivery Date:</strong> {formatDate(order.deliveryDate)}</p>
          </div>
      </div>

      {peopleWithMeasurements.map((person, pIdx) => (
        <div key={pIdx} className="mb-6 page-break-before"> {/* Add page break before each person */}
          <h2 className="text-lg font-semibold border-b pb-1 mb-3">{person.name || `Person ${pIdx + 1}`}</h2>
          {person.items.map((item, iIdx) => (
            <div key={iIdx} className="mb-4 pl-2 border-l-2 border-gray-300">
              <h3 className="font-semibold mb-1">{item.name || 'Unknown Item'}</h3>
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(item.measurements)
                      .filter(([, value]) => value && value.trim() !== '') // Only show fields with values
                      .map(([key, value]) => (
                          <tr key={key} className="border-b">
                              <td className="py-1 pr-2 font-medium w-1/3">{key}:</td>
                              <td className="py-1 pl-2">{value}</td>
                          </tr>
                  ))}
                </tbody>
              </table>
              {item.notes && <p className="text-xs mt-2 italic"><strong>Notes:</strong> {item.notes}</p>}
            </div>
          ))}
        </div>
      ))}
       {/* Add CSS for page break */}
       <style>{`
          @media print {
            .page-break-before {
              page-break-before: always;
            }
          }
       `}</style>
    </div>
  );
});

MeasurementsPrint.displayName = 'MeasurementsPrint'; // Add display name

MeasurementsPrint.propTypes = {
  order: PropTypes.object,
};

export default MeasurementsPrint;