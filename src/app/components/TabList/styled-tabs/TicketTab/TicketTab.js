import React from 'react';
import { Header, Segment, Label, Button } from 'semantic-ui-react';

export default function TicketTab(props) {
  const { ticket } = props;
  const {
    id,
    status,
    subject,
    ref,
    labels,
  } = ticket;

  return (
    <Segment padded>
      <Header as="h2">{subject}</Header>
      <p>ID: { id }</p>
      <p>Ref: { ref }</p>
      <p>Status: { status }</p>
      <Label.Group>
        {
          labels.map(label => <Label key={label}>{ label }</Label>)
        }
      </Label.Group>
      <div className="floated-btn-container">
        <Button
          negative
          floated="right"
          onClick={() => props.onDelete('tickets', id)}
        >Delete
        </Button>
      </div>
    </Segment>
  );
}